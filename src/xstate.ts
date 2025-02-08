import Parser from "tree-sitter";
import {
  configActionsQuery,
  configActorsQuery,
  configGuardsQuery,
  machineWithSetupQuery,
  setupActionsQuery,
  setupActorsQuery,
  setupGuardsQuery,
} from "./queries";
import {
  findAllCaptureMatches,
  findCaptureNodeWithText,
  isNodeType,
} from "./treesitter";
import { removeQuotes } from "./utils";

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

type ImplementationType = "action" | "actor" | "guard";

const setupQueryByImplementationType = {
  action: setupActionsQuery,
  actor: setupActorsQuery,
  guard: setupGuardsQuery,
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
  const actionNode = isNodeType(
    machineNode,
    position,
    configActionsQuery,
    "xstate.action",
  );

  if (actionNode)
    return {
      type: "action",
      node: actionNode,
      text: removeQuotes(actionNode.text),
    };

  const actorNode = isNodeType(
    machineNode,
    position,
    configActorsQuery,
    "xstate.actor",
  );

  if (actorNode)
    return {
      type: "actor",
      node: actorNode,
      text: removeQuotes(actorNode.text),
    };

  const guardNode = isNodeType(
    machineNode,
    position,
    configGuardsQuery,
    "xstate.guard",
  );

  if (guardNode)
    return {
      type: "guard",
      node: guardNode,
      text: removeQuotes(guardNode.text),
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
