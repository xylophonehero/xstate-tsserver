import {
  ScriptElementKind,
  type LanguageService,
  type server,
} from "typescript/lib/tsserverlibrary";
import {
  createNodeDefinitionWithDisplayParts,
  createNodeDefinitionWithTextSpan,
  createReferenceDefinition,
  getTransitionType,
} from "./utils";
import { getFileRootNode } from "./treesitter";
import {
  findAllImplementablesInMachine,
  getImplementableInMachine,
  getMachineConfigNodes,
  findImplementableInSetup,
  getImplementableInSetupInPosition,
  getStateConfigAtPosition,
  getAllDescendantStateObjects,
  getTransitionAtPosition,
  getCurrentStateAtPosition,
  getAllStateTargets,
} from "./xstate";

function init(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  // TODO: Figure out how bad it is to use the global typescript module even
  // though it might be different
  const ts = modules.typescript;

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

    function getMachineAtPosition(fileName: string, position: number) {
      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!sourceFile) return null;

      const rootNode = getFileRootNode(sourceFile);

      const machineConfigNodes = getMachineConfigNodes(rootNode, position);
      if (!machineConfigNodes) return null;

      return machineConfigNodes;
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

    // If used on a setup implementable, find the references within the machine
    // to it
    // If used on a machine implementable, find the reference within setup
    // function. If the setup implementable is a shorthand_property_identifier,
    // then merge in the references at that position
    proxy.findReferences = (fileName, position) => {
      const prior = info.languageService.findReferences(fileName, position);

      const machineConfigNodes = getMachineAtPosition(fileName, position);
      if (!machineConfigNodes) return prior;

      const { machineConfig, setupConfig, location } = machineConfigNodes;
      if (location === "setupConfig") {
        const { type, node, text } = getImplementableInSetupInPosition(
          setupConfig,
          position,
        );
        if (type === "unknown") return prior;
        log(`✅ Found ${type} implementation for ${text}`);
        const implementations = findAllImplementablesInMachine(
          machineConfig,
          type,
          text,
        );
        if (implementations.length === 0) return prior;

        return [
          ...(prior ?? []),
          {
            definition: createNodeDefinitionWithDisplayParts(fileName, node),
            references: implementations.map((implementation) =>
              createReferenceDefinition(fileName, implementation),
            ),
          },
        ];
      } else if (location === "machineConfig") {
        const { type, text, node } = getImplementableInMachine(
          machineConfig,
          position,
        );
        if (type === "unknown") return prior;

        const setupNode = findImplementableInSetup(setupConfig, type, text);
        if (setupNode) {
          log(`✅ Found ${type} definition for ${text} in setup`);
          return [
            ...(prior ?? []),
            ...(setupNode.type === "shorthand_property_identifier"
              ? (info.languageService.findReferences(
                  fileName,
                  setupNode.startIndex,
                ) ?? [])
              : []),
            {
              definition: createNodeDefinitionWithDisplayParts(fileName, node),
              references: [createReferenceDefinition(fileName, node)],
            },
          ];
        }
      }
      return prior;
    };

    // If used on a implementable within the machine config, find the definition
    // within the setup config
    // If the defintion is a shorthand_property_identifier, then use it's
    // definition for the implementable definition
    // If used on a transition target node, go to the state which it targets
    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      const prior = info.languageService.getDefinitionAndBoundSpan(
        fileName,
        position,
      );

      const machineConfigNodes = getMachineAtPosition(fileName, position);
      if (!machineConfigNodes) return prior;

      const { machineConfig, setupConfig, location } = machineConfigNodes;
      if (location !== "machineConfig") return prior;

      const { type, text, node } = getImplementableInMachine(
        machineConfig,
        position,
      );

      if (type !== "unknown") {
        const setupNode = findImplementableInSetup(setupConfig, type, text);
        if (setupNode) {
          log(`✅ Found ${type} definition for ${text} in setup`);
          if (setupNode.type === "shorthand_property_identifier")
            return info.languageService.getDefinitionAndBoundSpan(
              fileName,
              setupNode.startIndex,
            );
          return createNodeDefinitionWithTextSpan(fileName, setupNode, node);
        }
      }

      const { node: transitionNode, text: transitionText } =
        getTransitionAtPosition(machineConfig, position);

      if (transitionNode && transitionText) {
        const { target, type } = getTransitionType(transitionText);
        log(`✅ Found transition ${transitionText} at ${position}`);

        if (type === "absolute") {
          const states = getAllDescendantStateObjects(machineConfig);
          const [idTarget, ...rest] = target.split(".");
          const relativeTarget = rest.join(".");
          const idTargetNode = states.find((state) => state.id === idTarget);
          if (idTargetNode) {
            // If just a pure id, then go to the state
            if (relativeTarget === "") {
              log(`✅ Found state target ${idTargetNode.name} at ${position}`);
              return createNodeDefinitionWithTextSpan(
                fileName,
                idTargetNode.node,
                transitionNode,
              );
            } else {
              // If more after . then run the state children search
              const childStates = getAllDescendantStateObjects(idTargetNode.node);

              const stateTargetNode = childStates.find(
                (state) => state.path === relativeTarget,
              );

              if (stateTargetNode) {
                log(
                  `✅ Found state target ${stateTargetNode.path} at ${position}`,
                );
                return createNodeDefinitionWithTextSpan(
                  fileName,
                  stateTargetNode.node,
                  transitionNode,
                );
              }
            }
          }
        } else {
          const stateConfigParts = getStateConfigAtPosition(
            machineConfig,
            position,
          );

          const searchNode = stateConfigParts.at(
            type === "relativeChildren" ? -1 : -2,
          );
          if (!searchNode) return prior;

          const childStates = getAllDescendantStateObjects(searchNode.node);

          const stateTargetNode = childStates.find(
            (state) => state.path === target,
          );

          if (stateTargetNode) {
            log(`✅ Found state target ${stateTargetNode.path} at ${position}`);
            return createNodeDefinitionWithTextSpan(
              fileName,
              stateTargetNode.node,
              transitionNode,
            );
          }
        }
      }

      return prior;
    };

    proxy.getCompletionsAtPosition = (
      fileName,
      position,
      options,
      formatSettings,
    ) => {
      const prior = info.languageService.getCompletionsAtPosition(
        fileName,
        position,
        options,
        formatSettings,
      );
      log(`get completions at position ${position}`);

      const machineConfigNodes = getMachineAtPosition(fileName, position);
      if (!machineConfigNodes) return prior;

      const { machineConfig, location } = machineConfigNodes;
      if (location !== "machineConfig") return prior;

      const { node: transitionNode, text: transitionText } =
        getTransitionAtPosition(machineConfig, position);

      if (transitionNode) {
        log(
          `✅ Found transition ${transitionText ?? "(empty)"} at ${position}`,
        );

        // Get all state nodes
        const states = getAllDescendantStateObjects(machineConfig);
        const currentStateName = getCurrentStateAtPosition(
          machineConfig,
          position,
        );

        const stateTargets = getAllStateTargets(currentStateName, states);

        return {
          isGlobalCompletion: false,
          isMemberCompletion: true,
          isNewIdentifierLocation: false,
          entries: stateTargets.map((target) => ({
            name: target.targetId,
            kind: ScriptElementKind.string,
            sortText: target.sortText,
          })),
        };
      }

      return prior;
    };


    return proxy;
  }

  return { create };
}

export = init;
