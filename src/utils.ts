import Parser from "tree-sitter";

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
