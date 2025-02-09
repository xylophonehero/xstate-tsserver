import {
  and,
  AnyActorRef,
  AnyEventObject,
  assign,
  fromCallback,
  not,
  or,
  raise,
  sendTo,
  setup,
  spawnChild,
} from "xstate";
import { importedAction, importedGuard } from "./anotherFile";

const sameFileAction = () => {};

setup({
  types: {} as {
    context: { fooActor: AnyActorRef; anotherFooActor: AnyActorRef };
    events: { type: "event" };
  },
  actors: {
    simpleActor: fromCallback(() => {}),
    actorWithInput: fromCallback<AnyEventObject, { foo: "bar" }>(() => {}),
  },
  actions: {
    spawn: spawnChild("simpleActor"),
    aliasedAction: importedAction,
    sameFileAction,
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
  context: ({ spawn }) => ({
    fooActor: spawn("simpleActor"),
    anotherFooActor: spawn("actorWithInput", {
      input: { foo: "bar" },
    }),
  }),
  entry: [
    spawnChild("simpleActor"),
    spawnChild("actorWithInput", {
      input: { foo: "bar" },
    }),
    "aliasedAction",
    "sameFileAction",
    "importedAction",
    "simpleAction",
    {
      type: "actionWithParams",
      params: "hello",
    },
  ],
  exit: [
    spawnChild("simpleActor"),
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
          spawnChild("simpleActor"),
          assign({
            fooActor: ({ spawn }) => spawn("simpleActor"),
            anotherFooActor: ({ spawn }) =>
              spawn("actorWithInput", {
                input: { foo: "bar" },
              }),
          }),
        ],
      },
    ],
  },
});
