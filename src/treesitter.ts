import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { SourceFile } from "typescript";

export function createParser() {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  return parser;
}

export function getFileRootNode(sourceFile: SourceFile) {
  const parser = createParser();
  const tree = parser.parse(sourceFile.getFullText());
  return tree.rootNode;
}

export function findCaptureNodeWithText(
  rootNode: Parser.SyntaxNode,
  queryString: string,
  captureName: string,
  captureText: string,
) {
  const parser = createParser();
  const queryMatches = new Parser.Query(parser.getLanguage(), queryString);
  const matches = queryMatches.matches(rootNode);

  for (const match of matches) {
    const captureNode = match.captures.find(
      (cap) => cap.name === captureName && cap.node.text === captureText,
    )?.node;
    if (captureNode) {
      return captureNode;
    }
  }
}

export function findAllCaptureMatches(
  rootNode: Parser.SyntaxNode,
  queryString: string,
) {
  const parser = createParser();
  const queryMatches = new Parser.Query(parser.getLanguage(), queryString);
  const matches = queryMatches.matches(rootNode);

  const results: Record<string, Parser.SyntaxNode> = {};
  for (const match of matches) {
    for (const capture of match.captures) {
      results[capture.name] = capture.node;
    }
  }
  return results;
}

export function findMatchingNode(
  rootNode: Parser.SyntaxNode,
  position: number,
  queryString: string,
  captureMatch: string,
  returnCaptureMatch?: string,
) {
  const parser = createParser();
  const queryMatches = new Parser.Query(parser.getLanguage(), queryString);
  const matches = queryMatches.matches(rootNode);

  for (const match of matches) {
    const keyNode = match.captures.find(
      (cap) => cap.name === captureMatch,
    )?.node;
    if (keyNode) {
      if (position >= keyNode.startIndex && position <= keyNode.endIndex) {
        if (!returnCaptureMatch) return keyNode;
        const returnNode = match.captures.find(
          (cap) => cap.name === returnCaptureMatch,
        )?.node;
        if (returnNode) {
          return returnNode;
        }
      }
    }
  }

  return null;
}
