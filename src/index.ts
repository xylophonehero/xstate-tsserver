import {
  ScriptElementKind,
  type LanguageService,
  type server,
} from "typescript/lib/tsserverlibrary";
import {
  createNodeDefinitionWithDisplayParts,
  createNodeDefinitionWithTextSpan,
  createReferenceDefinition,
} from "./utils";
import { getFileRootNode } from "./treesitter";
import {
  findAllImplementablesInMachine,
  getImplementableInMachine,
  getMachineConfigNodes,
  findImplementableInSetup,
  getImplementableInSetupInPosition,
  getStateObjectsAtPosition,
  getAllDescendantStateObjects,
  getTransitionObjectAtPosition,
  getAllStateTargets,
  getInitialStateObjectAtPosition,
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
    // If used on an initial state identifier, go to the state which is targets
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

      const transitionObject = getTransitionObjectAtPosition(
        machineConfig,
        position,
      );
      if (transitionObject) {
        const {
          node: transitionNode,
          text: transitionText,
          target: transitionTarget,
          type: transitionType,
        } = transitionObject;

        log(`✅ Found transition ${transitionText} at ${position}`);
        const machineStates = getAllDescendantStateObjects(machineConfig);

        if (transitionType === "absolute") {
          const [idTarget, ...rest] = transitionTarget.split(".");
          const relativeTarget = rest.join(".");
          const stateWithId = machineStates.find(
            (state) => state.id === idTarget,
          );
          if (stateWithId) {
            // If just a pure id, then go to the state
            if (relativeTarget === "") {
              log(
                `✅ Found state target ${stateWithId.name || "(machine)"} at ${position}`,
              );
              return createNodeDefinitionWithTextSpan(
                fileName,
                stateWithId.node,
                transitionNode,
              );
            } else {
              // If more after . then run the state children search
              const stateTarget = machineStates.find(
                (state) =>
                  state.path === `${stateWithId.path}.${relativeTarget}`,
              );

              if (stateTarget) {
                log(`✅ Found state target ${stateTarget.path} at ${position}`);
                return createNodeDefinitionWithTextSpan(
                  fileName,
                  stateTarget.node,
                  transitionNode,
                );
              }
            }
          }
        } else {
          const currentStateObjects = getStateObjectsAtPosition(
            machineStates,
            position,
          );

          const baseStateObject = currentStateObjects.at(
            transitionType === "relativeChildren" ? -1 : -2,
          );
          if (!baseStateObject) return prior;

          const stateObjectTarget = machineStates.find(
            (state) =>
              state.path === `${baseStateObject.path}.${transitionTarget}`,
          );

          if (stateObjectTarget) {
            log(
              `✅ Found state target ${stateObjectTarget.path} at ${position}`,
            );
            return createNodeDefinitionWithTextSpan(
              fileName,
              stateObjectTarget.node,
              transitionNode,
            );
          }
        }
      }

      const initialStateObject = getInitialStateObjectAtPosition(
        machineConfig,
        position,
      );
      if (initialStateObject) {
        log(`✅ Found initial state ${initialStateObject.text} at ${position}`);
        const machineStates = getAllDescendantStateObjects(machineConfig);
        const currentStateObjects = getStateObjectsAtPosition(
          machineStates,
          position,
        );

        const currentStatePath = currentStateObjects.at(-1)?.path;
        const targetPath = `${currentStatePath}.${initialStateObject.text}`;
        const targetStateObject = machineStates.find(
          (state) => state.path === targetPath,
        );

        if (targetStateObject) {
          log(`✅ Found initial state target ${targetPath} at ${position}`);
          return createNodeDefinitionWithTextSpan(
            fileName,
            targetStateObject.node,
            initialStateObject.node,
          );
        }
      }

      return prior;
    };

    // If used on a transition target node, list all the possible transitions
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

      const machineConfigNodes = getMachineAtPosition(fileName, position);
      if (!machineConfigNodes) return prior;

      const { machineConfig, location } = machineConfigNodes;
      if (location !== "machineConfig") return prior;

      const transitionObject = getTransitionObjectAtPosition(
        machineConfig,
        position,
      );

      if (transitionObject) {
        const { node: transitionNode } = transitionObject;
        log(`✅ Found transition at ${position}`);
        const machineStates = getAllDescendantStateObjects(machineConfig);

        // Get all state nodes
        const currentStatePath =
          getStateObjectsAtPosition(machineStates, position).at(-1)?.path ?? "";

        const stateTargets = getAllStateTargets(
          currentStatePath,
          machineStates,
        );

        return {
          isGlobalCompletion: false,
          isMemberCompletion: true,
          isNewIdentifierLocation: false,
          entries: stateTargets.map((target) => ({
            replacementSpan: {
              start: transitionNode.startIndex + 1,
              length: transitionNode.endIndex - transitionNode.startIndex - 2,
            },
            name: target.transitionName,
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
