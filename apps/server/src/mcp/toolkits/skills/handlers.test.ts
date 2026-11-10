import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  ProviderInstanceId,
  SkillLibraryError,
  ThreadId,
  type RuntimeMode,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";
import * as SkillLibraryService from "../../../skills/SkillLibraryService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { liveThreadShell } from "../../McpToolAccess.testkit.ts";
import * as SkillHandlers from "./handlers.ts";
import { SkillToolkit } from "./tools.ts";

const threadId = ThreadId.make("thread:skills");
const calls: string[] = [];

const makeLayer = (runtimeMode: RuntimeMode) =>
  McpToolAccess.HandlersLayer.layer(SkillHandlers.layer).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(McpInvocationContext.McpInvocationContext, {
          environmentId: EnvironmentId.make("environment:skills"),
          requestNamespace: "provider:skills",
          thread: {
            threadId,
            providerSessionId: "provider:skills",
            providerInstanceId: ProviderInstanceId.make("codex"),
          },
          client: undefined,
          capabilities: new Set(["orchestration" as const]),
          issuedAt: 0,
        }),
        Layer.mock(ThreadManagement.ThreadManagementService)({
          getThreadShell: () => Effect.succeed(liveThreadShell(threadId, { runtimeMode })),
        }),
        Layer.mock(SkillLibraryService.SkillLibraryService)({
          list: () =>
            Effect.sync(() => void calls.push("list")).pipe(
              Effect.as({ libraryPath: "/lib", skills: [], targets: [], trash: [] }),
            ),
          write: (input) =>
            input.id === "taken"
              ? Effect.fail(new SkillLibraryError({ code: "conflict", message: "Already there." }))
              : Effect.sync(() => void calls.push(`write ${input.id}`)).pipe(
                  Effect.as({ id: input.id }),
                ),
          remove: (input) =>
            Effect.sync(() => void calls.push(`remove ${input.id}`)).pipe(
              Effect.as({ trashId: "20261110000000-abcdef" }),
            ),
        }),
      ),
    ),
  );

const run = (name: "t3_skill_list" | "t3_skill_write" | "t3_skill_remove", params: object) =>
  Effect.gen(function* () {
    const toolkit = yield* SkillToolkit;
    return yield* toolkit.handle(name, params as never).pipe(
      Stream.unwrap,
      Stream.runCollect,
      Effect.map((results) => results.at(-1)?.result),
    );
  });

const content = "---\nname: tidy\ndescription: Does a thing\n---\n";

it.effect("lets an agent in full access read, write and remove skills", () =>
  Effect.gen(function* () {
    calls.length = 0;
    yield* run("t3_skill_list", {});
    expect(yield* run("t3_skill_write", { id: "tidy", mode: "create", content })).toEqual({
      id: "tidy",
    });
    yield* run("t3_skill_remove", { id: "tidy" });
    expect(calls).toEqual(["list", "write tidy", "remove tidy"]);
  }).pipe(Effect.provide(makeLayer("full-access"))),
);

it.effect("refuses changes in any other mode, but still lists", () =>
  Effect.gen(function* () {
    calls.length = 0;
    yield* run("t3_skill_list", {});
    const refused = [
      yield* run("t3_skill_write", { id: "tidy", mode: "create", content }),
      yield* run("t3_skill_remove", { id: "tidy" }),
    ];
    for (const result of refused) {
      expect(result).toMatchObject({
        code: "capability_denied",
        message: expect.stringContaining("Settings → Skills"),
      });
    }
    expect(calls).toEqual(["list"]);
  }).pipe(Effect.provide(makeLayer("approval-required"))),
);

it.effect("reports the library's own refusals as invalid requests", () =>
  Effect.gen(function* () {
    expect(yield* run("t3_skill_write", { id: "taken", mode: "create", content })).toMatchObject({
      code: "invalid_request",
      message: "Already there.",
    });
  }).pipe(Effect.provide(makeLayer("full-access"))),
);
