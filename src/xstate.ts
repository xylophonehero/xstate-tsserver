import Parser from "tree-sitter";
import {
  machineActionsQuery,
  machineActorsQuery,
  machineDelaysQuery,
  machineGuardsQuery,
  machineWithSetupQuery,
  setupActionsQuery,
  setupActorsQuery,
  setupDelaysQuery,
  setupGuardsQuery,
  setupImplementableQuery,
  stateQuery,
  transitionQuery,
} from "./queries";
import {
  createParser,
  findCaptureNodeWithText,
  findMatchingNode,
  getAllCapturesOfMatch,
} from "./treesitter";
import { getTransitionType, TransitionType } from "./utils";

/**
 * Finds the machine at the given position and returns all capture groups within
 * the match
 */
function getMachineNodes(rootNode: Parser.SyntaxNode, position: number) {
  const parser = createParser();
  const queryMatches = new Parser.Query(
    parser.getLanguage(),
    machineWithSetupQuery,
  );
  const matches = queryMatches.matches(rootNode);

  const results: Record<string, Parser.SyntaxNode> = {};

  for (const match of matches) {
    const machineNode = match.captures.find(
      (cap) => cap.name === "xstate.machine",
    )?.node;
    if (
      machineNode &&
      machineNode.startIndex <= position &&
      position < machineNode.endIndex
    ) {
      for (const capture of match.captures) {
        results[capture.name] = capture.node;
      }
      continue;
    }
  }

  return results;
}

/**
 * Find the machine at the given position
 */
export function getMachineConfigNodes(
  rootNode: Parser.SyntaxNode,
  position: number,
) {
  const {
    "xstate.machine": machine,
    "xstate.root.config": machineConfig,
    "xstate.setup.config": setupConfig,
  } = getMachineNodes(rootNode, position);

  if (!machine || !machineConfig || !setupConfig) return null;

  let location = null;
  if (
    machineConfig.startIndex <= position &&
    position < machineConfig.endIndex
  ) {
    location = "machineConfig" as const;
  } else if (
    setupConfig.startIndex <= position &&
    position < setupConfig.endIndex
  ) {
    location = "setupConfig" as const;
  }
  if (!location) return null;

  return { machine, machineConfig, setupConfig, location };
}

type ImplementableType = "action" | "actor" | "guard" | "delay";

const setupQueryByImplementationType = {
  action: setupActionsQuery,
  actor: setupActorsQuery,
  guard: setupGuardsQuery,
  delay: setupDelaysQuery,
};

const machineQueryByImplementationType = {
  action: machineActionsQuery,
  actor: machineActorsQuery,
  guard: machineGuardsQuery,
  delay: machineDelaysQuery,
};

/**
 * Find the xstate implementation type at the given position
 * To be used with machine configuration
 */
export function getImplementableInMachine(
  machineNode: Parser.SyntaxNode,
  position: number,
):
  | {
      type: ImplementableType;
      node: Parser.SyntaxNode;
      text: string;
    }
  | {
      type: "unknown";
      node: null;
      text: string;
    } {
  const actionNode = findMatchingNode(
    machineNode,
    position,
    machineActionsQuery,
    "xstate.action",
    "xstate.action.name",
  );

  if (actionNode)
    return {
      type: "action",
      node: actionNode,
      text: actionNode.text,
    };

  const actorNode = findMatchingNode(
    machineNode,
    position,
    machineActorsQuery,
    "xstate.actor",
    "xstate.actor.name",
  );

  if (actorNode)
    return {
      type: "actor",
      node: actorNode,
      text: actorNode.text,
    };

  const guardNode = findMatchingNode(
    machineNode,
    position,
    machineGuardsQuery,
    "xstate.guard",
    "xstate.guard.name",
  );

  if (guardNode)
    return {
      type: "guard",
      node: guardNode,
      text: guardNode.text,
    };

  const delayNode = findMatchingNode(
    machineNode,
    position,
    machineDelaysQuery,
    "xstate.delay",
    "xstate.delay.name",
  );
  if (delayNode)
    return {
      type: "delay",
      node: delayNode,
      text: delayNode.text,
    };

  return { type: "unknown", node: null, text: "" };
}

/**
 * Find the implementation definition node for the given implementation type
 * and name
 * To be used within the setup configuration
 */
export function findImplementableInSetup(
  setupConfig: Parser.SyntaxNode,
  type: ImplementableType,
  implementationName: string,
) {
  const setupNode = findCaptureNodeWithText(
    setupConfig,
    setupQueryByImplementationType[type],
    `${type}.name`,
    implementationName,
  );

  return setupNode;
}

const setupKeyToImplementableType = {
  actions: "action",
  actors: "actor",
  guards: "guard",
  delays: "delay",
} as const;

/**
 * Find the setup node at the given position and also return it's implementable type
 */
export function getImplementableInSetupInPosition(
  setupConfig: Parser.SyntaxNode,
  position: number,
):
  | {
      type: ImplementableType;
      node: Parser.SyntaxNode;
      text: string;
    }
  | {
      type: "unknown";
      node: null;
      text: string;
    } {
  const parser = createParser();
  const queryMatches = new Parser.Query(
    parser.getLanguage(),
    setupImplementableQuery,
  );
  const matches = queryMatches.matches(setupConfig);

  for (const match of matches) {
    const keyNode = match.captures.find(
      (cap) => cap.name === "implementation.name",
    )?.node;
    if (keyNode) {
      if (position >= keyNode.startIndex && position < keyNode.endIndex) {
        const keyType = match.captures.find((cap) => cap.name === "setup.key")
          ?.node.text;
        const type =
          setupKeyToImplementableType[
            keyType as keyof typeof setupKeyToImplementableType
          ];
        if (type) {
          return {
            type,
            node: keyNode,
            text: keyNode.text,
          };
        }
      }
    }
  }

  return { type: "unknown", node: null, text: "" };
}

/**
 * Find all implementations of the given implementable type and name in the given machine
 */
export function findAllImplementablesInMachine(
  machineConfig: Parser.SyntaxNode,
  implementationType: ImplementableType,
  implementationName: string,
) {
  const parser = createParser();
  const queryMatches = new Parser.Query(
    parser.getLanguage(),
    machineQueryByImplementationType[implementationType],
  );
  const matches = queryMatches.matches(machineConfig);

  const implementations: Parser.SyntaxNode[] = [];
  for (const match of matches) {
    const keyNode = match.captures.find(
      (cap) => cap.name === `xstate.${implementationType}.name`,
    )?.node;
    if (keyNode && keyNode.text === implementationName) {
      implementations.push(keyNode);
    }
  }

  return implementations;
}

/**
 * Returns the transition (target) node at the given position
 */
export function getTransitionObjectAtPosition(
  rootNode: Parser.SyntaxNode,
  position: number,
) {
  const node = findMatchingNode(
    rootNode,
    position,
    transitionQuery,
    "transition.target",
  );
  if (!node) return null;
  const text = node.firstNamedChild?.text;
  const { type, target } = getTransitionType(text);

  return {
    node,
    type,
    target,
    text,
  };
}

interface StateObject {
  node: Parser.SyntaxNode;
  name: string;
  id: string;
  path: string;
}

/**
 * Finds all the descendant state nodes visible from the root node including itself
 * State paths will be nested with . separators relative to the root node
 */
export function getAllDescendantStateObjects(rootNode: Parser.SyntaxNode) {
  const parser = createParser();
  const queryMatches = new Parser.Query(parser.getLanguage(), stateQuery);
  const matches = queryMatches.matches(rootNode);

  const stateObjects: StateObject[] = [
    {
      node: rootNode,
      name: "",
      id: getStateId(rootNode),
      path: "",
    },
  ];

  for (const match of matches) {
    const {
      ["xstate.state.name"]: stateNameNode,
      ["xstate.state.config"]: stateConfigNode,
      ["xstate.state"]: fullStateNode,
    } = getAllCapturesOfMatch(match);

    if (!stateNameNode || !stateConfigNode || !fullStateNode) continue;

    const stateName = stateNameNode.text;
    const parentState = stateObjects.findLast(
      (state) =>
        state.node.startIndex <= fullStateNode.startIndex &&
        fullStateNode.endIndex <= state.node.endIndex,
    );
    const statePath = `${parentState?.path ?? ""}.${stateName}`;

    const stateId = getStateId(stateConfigNode);

    stateObjects.push({
      node: fullStateNode,
      name: stateName,
      path: statePath,
      id: stateId,
    });
  }

  return stateObjects;
}

/**
 * Filters the states objects to only include those with the current position.
 * The last one will be the current state
 */
export function getStateObjectsAtPosition(
  stateObject: StateObject[],
  position: number,
) {
  return stateObject.filter(
    (state) =>
      state.node.startIndex <= position && position < state.node.endIndex,
  );
}

/**
 * From a state config node, find the id by iterating through the object
 * properties
 */
function getStateId(stateConfigNode: Parser.SyntaxNode) {
  if (stateConfigNode.type !== "object") return "";
  for (const pair of stateConfigNode.namedChildren) {
    const [key, value] = pair.namedChildren;
    if (!key || !value) continue;
    if (key.type === "property_identifier" && key.text === "id") {
      if (value.type === "string") {
        return value.namedChildren[0].text;
      }
    }
  }
  return "";
}

interface StateTarget {
  type: TransitionType;
  sortText: string;
  transitionName: string;
  node: Parser.SyntaxNode;
}

export function getAllStateTargets(
  currentStatePath: string,
  machineStateObjects: StateObject[],
) {
  const stateTargets: StateTarget[] = [];
  for (const state of machineStateObjects) {
    const isCurrentState = state.path === currentStatePath;
    // First figure out the ids
    if (state.id) {
      stateTargets.push({
        type: "absolute",
        sortText: getStateSortText("absolute", state.id, isCurrentState),
        transitionName: `#${state.id}`,
        node: state.node,
      });
      for (const childState of machineStateObjects) {
        if (
          childState.path.startsWith(state.path) &&
          childState.path !== state.path
        ) {
          const childStateAbsolutePath = `${state.id}${childState.path.slice(
            state.path.length,
          )}`;
          stateTargets.push({
            type: "absolute",
            sortText: getStateSortText(
              "absolute",
              childStateAbsolutePath,
              childState.path === currentStatePath,
            ),
            transitionName: `#${childStateAbsolutePath}`,
            node: childState.node,
          });
        }
      }
    }

    // The root state can only be reached with an id
    if (state.path === "") continue;

    // Handle child states
    if (state.path.startsWith(currentStatePath) && !isCurrentState) {
      const transitionName = state.path.slice(currentStatePath.length + 1);
      stateTargets.push({
        type: "relativeChildren",
        sortText: getStateSortText("relativeChildren", transitionName),
        transitionName: `.${transitionName}`,
        node: state.node,
      });
    }

    // Handle sibling states
    // The root state node has no siblings
    if (currentStatePath === "") continue;

    const parentStatePath = getParentStatePath(currentStatePath);
    if (state.path.startsWith(parentStatePath)) {
      const transitionName = state.path.slice(parentStatePath.length + 1);
      stateTargets.push({
        type: "relative",
        sortText: getStateSortText("relative", transitionName, isCurrentState),
        transitionName,
        node: state.node,
      });
    }
  }
  return stateTargets;
}

const stateSortTextMap = {
  relativeChildren: 1,
  absolute: 2,
  relative: 0,
};

function getStateSortText(
  transitionType: Exclude<TransitionType, "unknown">,
  stateName: string,
  isCurrentState?: boolean,
) {
  return `${isCurrentState ? "z" : ""}${stateName.split(".").length - 1}${stateSortTextMap[transitionType]}`;
}

function getParentStatePath(statePath: string) {
  return statePath.split(".").slice(0, -1).join(".");
}
