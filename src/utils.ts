import Parser from "tree-sitter";
import {
  ReferencedSymbolEntry,
  ScriptElementKind,
} from "typescript/lib/tsserverlibrary";

export function createNodeDefinition(
  fileName: string,
  node: Parser.SyntaxNode,
) {
  return {
    name: node.text,
    textSpan: {
      start: node.startIndex,
      length: node.endIndex - node.startIndex,
    },
    fileName,
    // TODO: Check if these are correct and what else should be added
    containerName: "",
    containerKind: ScriptElementKind.unknown,
    kind: ScriptElementKind.string,
  };
}

export function createNodeDefinitionWithTextSpan(
  fileName: string,
  newNode: Parser.SyntaxNode,
  originalNode: Parser.SyntaxNode,
) {
  return {
    definitions: [createNodeDefinition(fileName, newNode)],
    textSpan: {
      start: originalNode.startIndex,
      length: originalNode.endIndex - originalNode.startIndex,
    },
  };
}

export function createNodeDefinitionWithDisplayParts(
  fileName: string,
  newNode: Parser.SyntaxNode,
) {
  return {
    ...createNodeDefinition(fileName, newNode),
    displayParts: [
      {
        kind: ScriptElementKind.string,
        text: newNode.text,
      },
    ],
  };
}

export function createReferenceDefinition(
  fileName: string,
  node: Parser.SyntaxNode,
  extraOpts?: Partial<ReferencedSymbolEntry>,
) {
  return {
    fileName,
    textSpan: {
      start: node.startIndex,
      length: node.endIndex - node.startIndex,
    },
    isWriteAccess: true,
    isDefinition: false,
    ...extraOpts,
  };
}

type TransitionType =
  // A string made up of words separated by dots
  | "relative"
  // A string made up of words separated by dots and starting with a dot
  | "relativeChildren"
  // A string made up of words separated by dots and starting with a hash
  | "absolute";

/**
 * Returns the transition type and target string
 */
export function getTransitionType(transition: string): {
  type: TransitionType;
  target: string;
} {
  if (transition.startsWith("#"))
    return {
      type: "absolute",
      target: transition.slice(1),
    };
  if (transition.startsWith(".")) {
    return {
      type: "relativeChildren",
      target: transition.slice(1),
    };
  }
  return {
    type: "relative",
    target: transition,
  };
}
