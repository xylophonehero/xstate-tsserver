import type { LanguageService, server } from "typescript/lib/tsserverlibrary";
import { createNodeDefinition } from "./utils";
import { getFileRootNode } from "./treesitter";
import {
  getImplementationType,
  getMachineConfigNodes,
  getSetupNode,
} from "./xstate";

function init(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  const ts = modules.typescript;

  function create(info: server.PluginCreateInfo) {
    // Diagnostic logging
    function log(message: string) {
      info.project.projectService.logger.info(message);
    }

    function getMachineUnderCursor(fileName: string, position: number) {
      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!sourceFile) return null;

      const rootNode = getFileRootNode(sourceFile);

      const machineConfigNodes = getMachineConfigNodes(rootNode, position);
      if (!machineConfigNodes) return null;

      return machineConfigNodes;
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

      const machineConfigNodes = getMachineUnderCursor(fileName, position);
      if (!machineConfigNodes) return prior;

      const { machineConfig, setupConfig } = machineConfigNodes;
      const { type, text } = getImplementationType(machineConfig, position);
      if (type === "unknown") return prior;

      const setupNode = getSetupNode(setupConfig, type, text);
      if (setupNode) {
        log(`✅ Found ${type} definition for ${text}`);
        if (setupNode.type === "shorthand_property_identifier")
          return info.languageService.getDefinitionAndBoundSpan(
            fileName,
            setupNode.startIndex,
          );
        return createNodeDefinition(ts, fileName, setupNode);
      }

      return prior;
    };

    return proxy;
  }

  return { create };
}

export = init;
