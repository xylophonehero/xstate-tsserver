import Parser from "tree-sitter";
import type { Node, SourceFile } from "typescript/lib/tsserverlibrary";

export function removeQuotes(text: string) {
  return text.slice(1, -1);
}

export function createNodeDefinition(
  ts: typeof import("typescript/lib/tsserverlibrary"),
  fileName: string,
  node: Parser.SyntaxNode,
) {
  return {
    textSpan: {
      start: node.startIndex,
      length: node.endIndex - node.startIndex,
    },
    definitions: [
      {
        fileName,
        textSpan: {
          start: node.startIndex,
          length: node.endIndex - node.startIndex,
        },
        name: node.text,
        kind: ts.ScriptElementKind.string,
        containerName: "",
        containerKind: ts.ScriptElementKind.unknown,
      },
    ],
  };
}

export function findNodeAtPosition(
  ts: typeof import("typescript/lib/tsserverlibrary"),
  sourceFile: SourceFile,
  position: number,
): Node | undefined {
  function find(node: Node): Node | undefined {
    if (position >= node.getStart() && position < node.getEnd()) {
      return ts.forEachChild(node, find) ?? node;
    }
  }
  return find(sourceFile);
}
