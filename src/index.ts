import type { LanguageService, server } from "typescript/lib/tsserverlibrary";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
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
  createNodeDefinition,
  findNodeAtPosition,
  removeQuotes,
} from "./utils";
import {
  findAllCaptureMatches,
  isNodeType,
  findCaptureNodeWithText,
  getFileRootNode,
} from "./treesitter";

function init(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  const ts = modules.typescript;
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);

  function create(info: server.PluginCreateInfo) {
    // Diagnostic logging
    function log(message: string) {
      info.project.projectService.logger.info(message);
    }
    log("xstate tsserver loaded");

    // Set up decorator object
    const proxy: LanguageService = Object.create(null);
    for (let k of Object.keys(info.languageService) as Array<
      keyof LanguageService
    >) {
      const x = info.languageService[k]!;
      // @ts-expect-error - JS runtime trickery which is tricky to type tersely
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
    }

    proxy.getQuickInfoAtPosition = (fileName, position) => {
      const prior = info.languageService.getQuickInfoAtPosition(
        fileName,
        position,
      );

      // TODO: Get the hover info for a thing inside a machine config and
      // display it's implementation

      return prior;
    };

    proxy.findReferences = (fileName, position) => {
      const prior = info.languageService.findReferences(fileName, position);

      // TODO: Figure out if a key inside a setup config and find all the
      // references. The reverse of getDefinitionAndBoundSpan

      return prior;
    };

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      const prior = info.languageService.getDefinitionAndBoundSpan(
        fileName,
        position,
      );

      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!sourceFile) return prior;

      const rootNode = getFileRootNode(sourceFile);

      const {
        "xstate.machine": machine,
        "xstate.root.config": machineConfig,
        "xstate.setup.config": setupConfig,
      } = findAllCaptureMatches(rootNode, machineWithSetupQuery);
      // Not in a machine
      if (!machine) return prior;

      const node = findNodeAtPosition(ts, sourceFile, position);
      if (!node) return prior;
      const hoveredText = node.getText();

      const isAction = isNodeType(
        machineConfig,
        configActionsQuery,
        position,
        "xstate.action",
      );

      if (isAction) {
        log(`✅ Found action definition: ${removeQuotes(hoveredText)}`);
        const actionNode = findCaptureNodeWithText(
          setupConfig,
          setupActionsQuery,
          "action.name",
          removeQuotes(hoveredText),
        );
        if (actionNode) {
          log(`✅ Found action node: ${actionNode.startPosition.row}`);
          return createNodeDefinition(ts, fileName, actionNode);
        }
      }

      const isGuard = isNodeType(
        machineConfig,
        configGuardsQuery,
        position,
        "xstate.guard",
      );

      if (isGuard) {
        log(`✅ Found guard definition: ${removeQuotes(hoveredText)}`);
        const guardNode = findCaptureNodeWithText(
          setupConfig,
          setupGuardsQuery,
          "guard.name",
          removeQuotes(hoveredText),
        );
        if (guardNode) {
          log(`✅ Found guard node: ${guardNode.startPosition.row}`);
          return createNodeDefinition(ts, fileName, guardNode);
        }
      }

      const isActor = isNodeType(
        machineConfig,
        configActorsQuery,
        position,
        "xstate.actor",
      );

      if (isActor) {
        log(`✅ Found actor definition: ${removeQuotes(hoveredText)}`);
        const actorNode = findCaptureNodeWithText(
          setupConfig,
          setupActorsQuery,
          "actor.name",
          removeQuotes(hoveredText),
        );
        if (actorNode) {
          log(`✅ Found actor node: ${actorNode.startPosition.row}`);
          return createNodeDefinition(ts, fileName, actorNode);
        }
      }

      return prior;
    };

    return proxy;
  }

  return { create };
}

export = init;
