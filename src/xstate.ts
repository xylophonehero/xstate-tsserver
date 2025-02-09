import Parser from "tree-sitter";
import {
  configActionsQuery,
  configActorsQuery,
  configDelaysQuery,
  configGuardsQuery,
  machineWithSetupQuery,
  setupActionsQuery,
  setupActorsQuery,
  setupDelaysQuery,
  setupGuardsQuery,
} from "./queries";
import {
  findAllCaptureMatches,
  findCaptureNodeWithText,
  findMatchingNode,
} from "./treesitter";

/**
 * Find the machine at the given position
 */
export function getMachineConfigNodes(
  rootNode: Parser.SyntaxNode,
  // TODO: Use position to find the machine we are in if there are multiple in
  // the file
  _position: number,
) {
  const {
    "xstate.machine": machine,
    "xstate.root.config": machineConfig,
    "xstate.setup.config": setupConfig,
  } = findAllCaptureMatches(rootNode, machineWithSetupQuery);

  if (!machine || !machineConfig || !setupConfig) return null;
  return { machine, machineConfig, setupConfig };
}

type ImplementationType = "action" | "actor" | "guard" | "delay";

const setupQueryByImplementationType = {
  action: setupActionsQuery,
  actor: setupActorsQuery,
  guard: setupGuardsQuery,
  delay: setupDelaysQuery,
};

/**
 * Find the xstate implementation type at the given position
 * To be used with machine configuration
 */
export function getImplementationType(
  machineNode: Parser.SyntaxNode,
  position: number,
):
  | {
      type: ImplementationType;
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
    configActionsQuery,
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
    configActorsQuery,
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
    configGuardsQuery,
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
    configDelaysQuery,
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
export const getSetupNode = (
  setupConfig: Parser.SyntaxNode,
  type: ImplementationType,
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
