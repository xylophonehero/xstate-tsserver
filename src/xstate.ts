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
} from "./treesitter";
import { TransitionType } from "./utils";

/**
 * Finds the machine at the given position and returns all capture groups within
 * the match
 */
const getMachineNodes = (rootNode: Parser.SyntaxNode, position: number) => {
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
};

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
export const findImplementableInSetup = (
  setupConfig: Parser.SyntaxNode,
  type: ImplementableType,
  implementationName: string,
) => {
  const setupNode = findCaptureNodeWithText(
    setupConfig,
    setupQueryByImplementationType[type],
    `${type}.name`,
    implementationName,
  );

  return setupNode;
};

const setupKeyToImplementableType = {
  actions: "action",
  actors: "actor",
  guards: "guard",
  delays: "delay",
} as const;

/**
 * Find the setup node at the given position and also return it's implementable type
 */
export const getImplementableInSetupInPosition = (
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
    } => {
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
};

/**
 * Find all implementations of the given implementable type and name in the given machine
 */
export const findAllImplementablesInMachine = (
  machineConfig: Parser.SyntaxNode,
  implementationType: ImplementableType,
  implementationName: string,
) => {
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
};

interface TransitionTarget {
  node: Parser.SyntaxNode;
  text: string;
}

/**
 * Returns the transition (target) node at the given position
 */
export const getTransitionAtPosition = (
  rootNode: Parser.SyntaxNode,
  position: number,
) => {
  const node = findMatchingNode(
    rootNode,
    position,
    transitionQuery,
    "transition.target",
  );
  const text = node?.firstNamedChild?.text;

  return {
    node,
    text,
  };
};

interface StateConfig {
  node: Parser.SyntaxNode;
  name: string;
  id: string;
}

/**
 * Finds the heirarchy of state configs at the given getTransitionAtPosition
 * Starts with the machine config and matches each state config along the
 * position
 * Must use the machine config as the root node
 */
export const getStateConfigAtPosition = (
  rootNode: Parser.SyntaxNode,
  position: number,
) => {
  const parser = createParser();
  const queryMatches = new Parser.Query(parser.getLanguage(), stateQuery);
  const matches = queryMatches.matches(rootNode);

  const stateParts: StateConfig[] = [
    {
      node: rootNode,
      name: "",
      id: getStateId(rootNode),
    },
  ];

  for (const match of matches) {
    match.captures.forEach((cap) => {
      if (
        cap.name === "xstate.state" &&
        cap.node.startIndex <= position &&
        position < cap.node.endIndex
      ) {
        const stateName = match.captures.find(
          (cap) => cap.name === "xstate.state.name",
        )?.node.text;

        const stateConfig = match.captures.find(
          (cap) => cap.name === "xstate.state.config",
        )?.node;

        const stateId = stateConfig ? getStateId(stateConfig) : "";

        if (stateName) {
          stateParts.push({
            node: cap.node,
            name: stateName,
            id: stateId,
          });
        }
      }
    });
  }

  return stateParts;
};

export const getCurrentStateAtPosition = (
  rootNode: Parser.SyntaxNode,
  position: number,
) => {
  const stateConfigParts = getStateConfigAtPosition(rootNode, position);
  return stateConfigParts
    .slice(1)
    .map((state) => state.name)
    .join(".");
};

/**
 * Finds all the descendant state nodes visible from the root node including itself
 * Child names will be nested with . separators relative to the root node
 */
export const getAllDescendantStateNodes = (rootNode: Parser.SyntaxNode) => {
  const parser = createParser();
  const queryMatches = new Parser.Query(parser.getLanguage(), stateQuery);
  const matches = queryMatches.matches(rootNode);

  const states: StateConfig[] = [
    {
      node: rootNode,
      name: "",
      id: getStateId(rootNode),
    },
  ];

  for (const match of matches) {
    match.captures.forEach((cap) => {
      if (cap.name === "xstate.state") {
        const stateName = match.captures.find(
          (cap) => cap.name === "xstate.state.name",
        )?.node.text;
        const anscestorStates = states.filter(
          (state) =>
            state.node.startIndex <= cap.node.startIndex &&
            cap.node.endIndex <= state.node.endIndex,
        );
        const parentState = anscestorStates.at(-1);
        const stateConfig = match.captures.find(
          (cap) => cap.name === "xstate.state.config",
        )?.node;
        const stateId = stateConfig ? getStateId(stateConfig) : "";
        if (stateName) {
          states.push({
            node: cap.node,
            name: [
              ...(parentState?.name ? [parentState.name] : []),
              stateName,
            ].join("."),
            id: stateId,
          });
        }
      }
    });
  }

  return states;
};

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

export function getAllStateTargets(
  currentState: string,
  stateNodes: StateConfig[],
) {
  const targets = [];
  for (const state of stateNodes) {
    const isCurrentState = state.name === currentState;
    // First figure out the ids
    if (state.id) {
      targets.push({
        type: "absolute",
        sortText: getStateSortText("absolute", state.id, isCurrentState),
        targetId: `#${state.id}`,
        node: state.node,
      });
      // TODO: push all children of this state
    }

    if (state.name === "") continue;

    // Handle child states
    if (state.name.startsWith(currentState) && !isCurrentState) {
      const targetId = state.name.slice(
        currentState === "" ? 0 : currentState.length + 1,
      );
      targets.push({
        type: "relativeChildren",
        sortText: getStateSortText("relativeChildren", targetId),
        targetId: `.${targetId}`,
        node: state.node,
      });
    }

    // Handle sibling states
    if (currentState === "") continue;

    const parentState = currentState.split(".").slice(0, -1).join(".");
    if (state.name.startsWith(parentState)) {
      const targetId = state.name.slice(parentState.length);
      targets.push({
        type: "relative",
        sortText: getStateSortText("relative", targetId, isCurrentState),
        targetId: targetId,
        node: state.node,
      });
    }
  }
  return targets;
}

const stateSortTextMap = {
  relativeChildren: 1,
  absolute: 2,
  relative: 0,
};

function getStateSortText(
  transitionType: TransitionType,
  stateName: string,
  isCurrentState?: boolean,
) {
  return `${isCurrentState ? "z" : ""}${stateName.split(".").length - 1}${stateSortTextMap[transitionType]}`;
}
