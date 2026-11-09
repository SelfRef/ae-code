import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as MemoryService from "../../../memory/MemoryService.ts";
import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { liveThreadShell } from "../../McpToolAccess.testkit.ts";
import * as MemoryHandlers from "./handlers.ts";
import { MemoryToolkit } from "./tools.ts";

const threadId = ThreadId.make("thread:memory");
const shell = liveThreadShell(threadId);

const saved: Array<Parameters<MemoryService.MemoryService["Service"]["save"]>[0]> = [];
const recalled: Array<Parameters<MemoryService.MemoryService["Service"]["recall"]>[0]> = [];

const layer = McpToolAccess.HandlersLayer.layer(MemoryHandlers.layer).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Layer.succeed(McpInvocationContext.McpInvocationContext, {
        environmentId: EnvironmentId.make("environment:memory"),
        requestNamespace: "provider:memory",
        thread: {
          threadId,
          providerSessionId: "provider:memory",
          providerInstanceId: ProviderInstanceId.make("codex"),
        },
        client: undefined,
        capabilities: new Set(["orchestration" as const]),
        issuedAt: 0,
      }),
      Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadShell: () => Effect.succeed(shell),
      }),
      Layer.mock(MemoryService.MemoryService)({
        recall: (input) => Effect.sync(() => void recalled.push(input)).pipe(Effect.as([])),
        save: (input) =>
          Effect.sync(() => void saved.push(input)).pipe(
            Effect.as({
              id: "mem_1" as never,
              scope: input.scope,
              projectId: input.projectId ?? null,
              text: input.text,
              source: input.source,
              sourceThreadId: null,
              createdAt: "2026-11-09T00:00:00.000Z",
              updatedAt: "2026-11-09T00:00:00.000Z",
            }),
          ),
      }),
    ),
  ),
);

it.effect("saves and recalls inside the calling thread's project, as the agent", () =>
  Effect.gen(function* () {
    const toolkit = yield* MemoryToolkit;
    const run = (name: "t3_memory_recall" | "t3_memory_remember", params: object) =>
      toolkit.handle(name, params as never).pipe(
        Stream.unwrap,
        Stream.runCollect,
        Effect.map((results) => results.at(-1)?.result),
      );

    yield* run("t3_memory_remember", { text: "Use oxfmt", scope: "project" });
    yield* run("t3_memory_remember", { text: "Reply in Polish", scope: "user" });
    yield* run("t3_memory_recall", { query: "formatter" });

    expect(saved).toMatchObject([
      { scope: "project", projectId: shell.projectId, source: "agent", sourceThreadId: threadId },
      { scope: "user", projectId: undefined, source: "agent", sourceThreadId: threadId },
    ]);
    expect(recalled).toMatchObject([{ query: "formatter", projectId: shell.projectId }]);
  }).pipe(Effect.provide(layer)),
);
