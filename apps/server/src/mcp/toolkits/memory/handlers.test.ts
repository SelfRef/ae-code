import { expect, it } from "@effect/vitest";
import { EnvironmentId, MemoryError, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as ServerEnvironment from "../../../environment/ServerEnvironment.ts";
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

const makeLayer = (
  requireEnabled: Effect.Effect<void, MemoryError>,
  client?: McpInvocationContext.McpClientCaller,
) =>
  McpToolAccess.HandlersLayer.layer(MemoryHandlers.layer).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(McpInvocationContext.McpInvocationContext, {
          environmentId: EnvironmentId.make("environment:memory"),
          requestNamespace: "provider:memory",
          thread:
            client === undefined
              ? {
                  threadId,
                  providerSessionId: "provider:memory",
                  providerInstanceId: ProviderInstanceId.make("codex"),
                }
              : undefined,
          client,
          capabilities: new Set(["orchestration" as const]),
          issuedAt: 0,
        }),
        Layer.mock(ThreadManagement.ThreadManagementService)({
          getThreadShell: () => Effect.succeed(shell),
        }),
        Layer.mock(ServerEnvironment.ServerEnvironment)({
          getEnvironmentId: Effect.succeed(EnvironmentId.make("environment:memory")),
        }),
        Layer.mock(MemoryService.MemoryService)({
          requireEnabled,
          settings: Effect.succeed({ enabled: true, disableNativeMemory: true, sync: true }),
          changesSince: (since) => Effect.succeed({ records: [], rev: since }),
          merge: () => Effect.void,
          recordPeer: () => Effect.void,
          recall: (input) => Effect.sync(() => void recalled.push(input)).pipe(Effect.as([])),
          save: (input) =>
            Effect.sync(() => void saved.push(input)).pipe(
              Effect.as({
                id: "mem_1" as never,
                scope: input.scope ?? "user",
                projectId: input.projectId ?? null,
                projectKey: null,
                projectLabel: null,
                originEnvironmentId: null,
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

const layer = makeLayer(Effect.void);

const run = (
  name: "t3_memory_recall" | "t3_memory_remember" | "t3_memory_forget" | "t3_memory_sync",
  params: object,
) =>
  Effect.gen(function* () {
    const toolkit = yield* MemoryToolkit;
    return yield* toolkit.handle(name, params as never).pipe(
      Stream.unwrap,
      Stream.runCollect,
      Effect.map((results) => results.at(-1)?.result),
    );
  });

it.effect("refuses every tool while memory is turned off, without touching the store", () =>
  Effect.gen(function* () {
    const before = saved.length + recalled.length;
    const results = [
      yield* run("t3_memory_recall", { query: "formatter" }),
      yield* run("t3_memory_remember", { text: "Use oxfmt", scope: "user" }),
      yield* run("t3_memory_forget", { memoryId: "mem_1" }),
    ];
    for (const result of results)
      expect(result).toMatchObject({
        code: "invalid_request",
        message: expect.stringContaining("turned off"),
      });
    expect(saved.length + recalled.length).toBe(before);
  }).pipe(
    Effect.provide(
      makeLayer(
        Effect.fail(new MemoryError({ code: "disabled", message: "Memory is turned off." })),
      ),
    ),
  ),
);

it.effect("saves and recalls inside the calling thread's project, as the agent", () =>
  Effect.gen(function* () {
    yield* run("t3_memory_remember", { text: "Use oxfmt", scope: "project" });
    yield* run("t3_memory_remember", { text: "Reply in Polish", scope: "user" });
    yield* run("t3_memory_remember", {
      text: "Reply in English",
      scope: "user",
      memoryId: "mem_1",
    });
    yield* run("t3_memory_recall", { query: "formatter" });

    expect(saved).toMatchObject([
      { scope: "project", projectId: shell.projectId, source: "agent", sourceThreadId: threadId },
      { scope: "user", projectId: undefined, source: "agent", sourceThreadId: threadId },
      // A correction keeps the memory's scope.
      { id: "mem_1", scope: undefined, projectId: undefined },
    ]);
    expect(recalled).toMatchObject([{ query: "formatter", projectId: shell.projectId }]);
  }).pipe(Effect.provide(layer)),
);

const syncParams = { from: "environment:peer", label: "Peer", since: 0, changes: [] };
const linkClient = (access: McpInvocationContext.McpClientCaller["access"]) => ({
  sessionId: "session:peer",
  label: "Peer",
  access,
  linked: true,
});

it.effect("syncs memory only with a full-access peer link, never an agent", () =>
  Effect.gen(function* () {
    const agent = yield* run("t3_memory_sync", syncParams);
    const readOnly = yield* run("t3_memory_sync", syncParams).pipe(
      Effect.provide(makeLayer(Effect.void, linkClient("auto"))),
    );
    const full = yield* run("t3_memory_sync", syncParams).pipe(
      Effect.provide(makeLayer(Effect.void, linkClient("full-access"))),
    );
    expect(agent).toMatchObject({ code: "capability_denied" });
    expect(readOnly).toMatchObject({ code: "capability_denied" });
    expect(full).toEqual({ changes: [], rev: 0 });
  }).pipe(Effect.provide(layer)),
);
