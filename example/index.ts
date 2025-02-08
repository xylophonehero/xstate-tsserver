import { and, fromCallback, not, or, setup } from "xstate";

const importedAction = () => {};
const importedGuard = () => true;

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
      invoke: [
        {
          src: "simpleActor",
        },
        {
          src: "simpleActor",
        },
      ],
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
