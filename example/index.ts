import { and, fromCallback, not, or, raise, sendTo, setup } from "xstate";
import { importedAction, importedGuard } from "./anotherFile";

setup({
  types: {} as {
    context: {};
    events: { type: "event" };
  },
  actors: {
    simpleActor: fromCallback(() => {}),
  },
  actions: {
    importedAction,
    simpleAction: () => {},
    actionWithParams: (_, _params: string) => {},
  },
  guards: {
    importedGuard,
    simpleGuard: () => true,
    guardWithParams: (_, _params: string) => true,
  },
  delays: {
    simpleDelay: 1000,
    functionDelay: () => 1000,
  },
}).createMachine({
  entry: [
    "importedAction",
    "simpleAction",
    {
      type: "actionWithParams",
      params: "hello",
    },
  ],
  exit: [
    "importedAction",
    "simpleAction",
    {
      type: "actionWithParams",
      params: "hello",
    },
  ],
  invoke: {
    src: "simpleActor",
  },
  initial: "idle",
  states: {
    idle: {
      entry: [
        raise({ type: "event" }, { delay: "functionDelay" }),
        sendTo("thing", { type: "event" }, { delay: "simpleDelay" }),
      ],
      invoke: [
        {
          src: "simpleActor",
        },
        {
          src: "simpleActor",
        },
      ],
      after: {
        simpleDelay: {},
        functionDelay: {},
      },
    },
  },
  on: {
    event: [
      {
        guard: "importedGuard",
      },
      {
        guard: "simpleGuard",
      },
      {
        guard: { type: "guardWithParams", params: "hello" },
      },
      {
        guard: not("simpleGuard"),
      },
      {
        guard: not({ type: "guardWithParams", params: "hello" }),
      },
      {
        guard: and([
          { type: "guardWithParams", params: "hello" },
          { type: "guardWithParams", params: "hello" },
        ]),
      },
      {
        guard: or(["simpleGuard", "simpleGuard"]),
      },
      {
        guard: or([
          { type: "guardWithParams", params: "hello" },
          { type: "guardWithParams", params: "hello" },
        ]),
      },
      {
        actions: [
          "importedAction",
          "simpleAction",
          {
            type: "actionWithParams",
            params: "hello",
          },
        ],
      },
    ],
  },
});
