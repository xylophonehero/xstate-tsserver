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
    events: { type: "event" } | { type: "event2" } | { type: "event3" };
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
          onDone: {
            target: "b",
          },
          onError: "c",
        },
        {
          src: "simpleActor",
          onDone: [
            {
              guard: "simpleGuard",
              target: "b",
            },
            {
              target: "c",
            },
          ],
        },
      ],
      after: {
        simpleDelay: {
          target: "b",
        },
        functionDelay: [
          {
            guard: "simpleGuard",
            target: "b",
          },
          {
            target: "c",
          },
        ],
      },
      on: {
        event: {
          target: "b",
        },
        event2: [
          {
            guard: "simpleGuard",
            target: "b",
          },
          {
            target: "c",
          },
        ],
        event3: "b",
      },
    },
    b: {
      after: {
        simpleDelay: [
          {
            guard: "simpleGuard",
            target: ".child",
          },
          {
            target: ".child2",
          },
        ],
      },
      initial: "child",
      states: {
        child: {},
        child2: {},
      },
    },
    c: {
      on: {
        event: "deep1.deep2.deep3.deep4",
      },
      states: {
        noInitial: {},
      },
    },
    deep1: {
      on: {
        event: ".deep2",
        event2: ".deep2.deep3",
        event3: ".deep2.deep3.deep4",
      },
      states: {
        deep2: {
          states: {
            deep3: {
              states: {
                deep4: {},
              },
            },
          },
        },
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
