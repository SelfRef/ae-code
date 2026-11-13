import { ProjectId, ProviderInstanceId, ThreadId, type ModelSelection } from "@t3tools/contracts";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { describe, expect } from "vite-plus/test";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import { handOffMerge } from "./handOffMerge.ts";

const own: ModelSelection = { instanceId: ProviderInstanceId.make("claudeAgent"), model: "opus" };
const merger: ModelSelection = {
  instanceId: ProviderInstanceId.make("claudeAgent"),
  model: "haiku",
};
const threadId = ThreadId.make("thread-1");

const run = (afterTurn: ModelSelection | null, override: ModelSelection | undefined) => {
  const dispatched: Array<{ type: string; modelSelection?: ModelSelection }> = [];
  let current: ModelSelection = own;
  const service = {
    getThreadShell: () =>
      Effect.sync(() => ({ projectId: ProjectId.make("project-1"), modelSelection: current })),
    dispatch: (command: { type: string; modelSelection?: ModelSelection }) =>
      Effect.sync(() => {
        dispatched.push(command);
        if (command.modelSelection !== undefined) current = command.modelSelection;
        // The agent's turn runs on the override, which message.dispatch writes to the thread.
        return {};
      }),
    waitForThread: () =>
      Effect.sync(() => {
        if (afterTurn !== null) current = afterTurn;
        return {};
      }),
  };
  return handOffMerge({
    threadId,
    action: "merge",
    error: "conflict",
    modelSelection: override,
    uuid: "u",
  }).pipe(
    Effect.provideService(
      ThreadManagementService.ThreadManagementService,
      service as unknown as ThreadManagementService.ThreadManagementServiceShape,
    ),
    Effect.map((result) => ({ result, dispatched })),
  );
};

describe("handOffMerge", () => {
  it.effect("puts the thread's own model back after a turn on another model", () =>
    Effect.gen(function* () {
      const { result, dispatched } = yield* run(merger, merger);
      expect(result).toBe(true);
      expect(dispatched.map((command) => command.type)).toEqual([
        "message.dispatch",
        "thread.model-selection.set",
      ]);
      expect(dispatched[1]?.modelSelection).toEqual(own);
    }),
  );

  it.effect("keeps a model picked while the turn ran", () =>
    Effect.gen(function* () {
      const picked: ModelSelection = { instanceId: merger.instanceId, model: "sonnet" };
      const { dispatched } = yield* run(picked, merger);
      expect(dispatched.map((command) => command.type)).toEqual(["message.dispatch"]);
    }),
  );

  it.effect("does nothing extra without an override", () =>
    Effect.gen(function* () {
      const { dispatched } = yield* run(null, undefined);
      expect(dispatched.map((command) => command.type)).toEqual(["message.dispatch"]);
    }),
  );
});
