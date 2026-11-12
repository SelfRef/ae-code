import {
  EnvironmentId,
  IssueError,
  ProjectId,
  ProviderInstanceId,
  SourceControlProviderKind,
  ThreadId,
  type IssueSummary,
  type OrchestrationProjectShell,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import type { Tool } from "effect/ai";

import * as IssueService from "../../../issue/IssueService.ts";
import * as Orchestrator from "../../../orchestration-v2/Orchestrator.ts";
import {
  type PullRequestTestThread,
  v2PullRequestThread,
} from "../../../orchestration-v2/testkit/pullRequestFixtures.ts";
import * as ProjectService from "../../../project/ProjectService.ts";
import * as PullRequestService from "../../../pullRequest/PullRequestService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import * as McpToolAccessTestkit from "../../McpToolAccess.testkit.ts";
import * as SourceControlHandlers from "./handlers.ts";
import { SourceControlToolkit } from "./tools.ts";

const PROJECT_ID = ProjectId.make("project-1");
const THREAD_ID = ThreadId.make("thread-1");
const PR_URL = "https://github.com/T3Tools/T3Code/pull/5";

const invocation = (thread: boolean): McpInvocationContext.McpInvocationScope => ({
  environmentId: EnvironmentId.make("environment-1"),
  requestNamespace: "provider-session-1",
  thread: thread
    ? {
        threadId: THREAD_ID,
        providerSessionId: "provider-session-1",
        providerInstanceId: ProviderInstanceId.make("codex"),
      }
    : undefined,
  client: undefined,
  capabilities: new Set<McpInvocationContext.McpCapability>(["pull-requests"]),
  issuedAt: 1,
});

const project: OrchestrationProjectShell = {
  id: PROJECT_ID,
  title: "Project",
  workspaceRoot: "/workspace/project",
  defaultModelSelection: null,
  scripts: [],
  repositoryIdentity: {
    canonicalKey: "github.com/t3tools/t3code",
    locator: {
      source: "git-remote",
      remoteName: "origin",
      remoteUrl: "git@github.com:T3Tools/T3Code.git",
    },
    provider: SourceControlProviderKind.make("github"),
    displayName: "T3Tools/T3Code",
    owner: "T3Tools",
    name: "T3Code",
  },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const thread: PullRequestTestThread = {
  id: THREAD_ID,
  projectId: PROJECT_ID,
  title: "Thread",
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  pullRequests: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  archivedAt: null,
  settledOverride: null,
  settledAt: null,
  latestUserMessageAt: "2026-08-20T00:00:00.000Z",
};

const issueSummary = (number: number, state: IssueSummary["state"] = "open"): IssueSummary => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/t3tools/t3code/issues/${number}`,
  state,
  stateReason: state === "closed" ? "not-planned" : null,
  author: { login: "ada", name: null, avatarUrl: null },
  assignees: [],
  labels: [{ name: "bug", color: null }],
  commentCount: 0,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  closedAt: null,
});

const makeHarness = Effect.fn("makeSourceControlToolkitHarness")(function* () {
  const calls = yield* Ref.make<ReadonlyArray<readonly [string, unknown]>>([]);
  const record = (name: string) => (input: unknown) =>
    Ref.update(calls, (recorded) => [...recorded, [name, input] as const]);
  const layerDependencies = Layer.mergeAll(
    Layer.mock(ProjectService.ProjectService)({
      getShell: () => Effect.succeedSome(project),
      listShells: () => Effect.succeed([project]),
    }),
    Layer.mock(Orchestrator.OrchestratorV2)({
      getThreadShell: (id) => Effect.succeed(id === thread.id ? v2PullRequestThread(thread) : null),
    }),
    Layer.mock(PullRequestService.PullRequestService)({
      withRoutingCredential: (_ref, operation) => operation,
      comment: record("comment"),
      replyToThread: record("replyToThread"),
      setThreadResolution: record("setThreadResolution"),
      submitReview: record("submitReview"),
      update: record("update"),
      setLabels: record("setLabels"),
      requestReviewers: record("requestReviewers"),
      runAction: (input) =>
        record("runAction")(input).pipe(Effect.as({ state: "merged", isDraft: false } as never)),
    }),
    Layer.mock(IssueService.IssueService)({
      list: (input) =>
        record("issues.list")(input).pipe(
          Effect.as({
            repository: "t3tools/t3code",
            host: "github.com",
            issues: [],
            hasMore: false,
          }),
        ),
      update: (input) =>
        record("issues.update")(input).pipe(
          Effect.andThen(
            input.number === 404
              ? Effect.fail(
                  new IssueError({ reason: "not-found", detail: "#404 is a pull request." }),
                )
              : Effect.succeed(issueSummary(input.number, "closed")),
          ),
        ),
    }),
    McpToolAccessTestkit.liveThreadsLayer,
  );
  const toolkit = yield* SourceControlToolkit.pipe(
    Effect.provide(
      McpToolAccess.HandlersLayer.layer(SourceControlHandlers.layer).pipe(
        Layer.provide(layerDependencies),
      ),
    ),
  );
  const call = <Name extends keyof typeof SourceControlToolkit.tools>(
    name: Name,
    params: Parameters<typeof toolkit.handle<Name>>[1],
    inThread = true,
  ) =>
    toolkit.handle(name, params).pipe(
      Stream.unwrap,
      Stream.runCollect,
      Effect.map(
        (chunk) => chunk.at(-1)!.result as Tool.Success<(typeof SourceControlToolkit.tools)[Name]>,
      ),
      Effect.provideService(McpInvocationContext.McpInvocationContext, invocation(inThread)),
      Effect.provide(layerDependencies),
    );
  return { calls, call };
});

describe("source control toolkit handlers", () => {
  it.effect("lists issues in this thread's project and needs a project outside a thread", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      yield* harness.call("list_issues", { query: "label:bug" });
      expect(yield* Ref.get(harness.calls)).toEqual([
        ["issues.list", { projectId: PROJECT_ID, state: "open", query: "label:bug" }],
      ]);
      const error = yield* harness.call("list_issues", {}, false).pipe(Effect.flip);
      expect(error._tag).toBe("SourceControlProjectRequiredError");
    }),
  );

  it.effect("updates an issue, sending only what was passed, and refuses a stray reason", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const result = yield* harness.call("update_issue", {
        number: 7,
        state: "closed",
        stateReason: "not-planned",
        comment: "Closing.",
      });
      expect(result).toMatchObject({ number: 7, state: "closed", labels: ["bug"], author: "ada" });
      expect(yield* Ref.get(harness.calls)).toEqual([
        [
          "issues.update",
          {
            projectId: PROJECT_ID,
            number: 7,
            state: "closed",
            stateReason: "not-planned",
            comment: "Closing.",
          },
        ],
      ]);
      const refused = yield* harness
        .call("update_issue", { number: 7, stateReason: "completed" })
        .pipe(Effect.flip);
      expect(refused._tag).toBe("SourceControlInvalidRequestError");
      const failure = yield* harness.call("update_issue", { number: 404 }).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "SourceControlRequestFailedError",
        detail: "#404 is a pull request.",
      });
    }),
  );

  it.effect("replies to a review thread, resolves it, and needs a body or a thread", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const ref = {
        projectId: PROJECT_ID,
        host: "github.com",
        repository: "t3tools/t3code",
        number: 5,
      };
      yield* harness.call("comment_on_pull_request", { url: PR_URL, body: "Thanks" });
      const reply = yield* harness.call("comment_on_pull_request", {
        url: PR_URL,
        reviewThreadId: "PRRT_1",
        body: "Fixed",
        resolved: true,
      });
      expect(reply).toEqual({
        repository: "t3tools/t3code",
        number: 5,
        posted: true,
        resolved: true,
      });
      expect(yield* Ref.get(harness.calls)).toEqual([
        ["comment", { ...ref, body: "Thanks" }],
        ["replyToThread", { ...ref, threadId: "PRRT_1", body: "Fixed" }],
        ["setThreadResolution", { ...ref, threadId: "PRRT_1", resolved: true }],
      ]);
      const nothing = yield* harness
        .call("comment_on_pull_request", { url: PR_URL })
        .pipe(Effect.flip);
      expect(nothing._tag).toBe("SourceControlInvalidRequestError");
    }),
  );

  it.effect("submits a review with removed lines on the old side", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const result = yield* harness.call("review_pull_request", {
        url: PR_URL,
        verdict: "request-changes",
        comments: [
          { path: "a.ts", line: 3, body: "Why?" },
          { path: "b.ts", line: 9, side: "old", body: "Keep this" },
        ],
      });
      expect(result).toMatchObject({ verdict: "request-changes", commentCount: 2 });
      expect(yield* Ref.get(harness.calls)).toMatchObject([
        [
          "submitReview",
          {
            verdict: "request-changes",
            body: "",
            comments: [
              { path: "a.ts", position: { kind: "added", newLine: 3 }, body: "Why?" },
              { path: "b.ts", position: { kind: "deleted", oldLine: 9 }, body: "Keep this" },
            ],
          },
        ],
      ]);
    }),
  );

  it.effect("updates a pull request's fields, labels and reviewers, teams included", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const result = yield* harness.call("update_pull_request", {
        url: PR_URL,
        title: "New title",
        addLabels: ["bug"],
        requestReviewers: ["ada", "team:core"],
      });
      expect(result.changed).toEqual(["title", "addLabels", "requestReviewers"]);
      expect(yield* Ref.get(harness.calls)).toMatchObject([
        ["update", { title: "New title" }],
        ["setLabels", { labels: ["bug"], applied: true }],
        [
          "requestReviewers",
          {
            requested: true,
            reviewers: [
              { id: "ada", kind: "user" },
              { id: "core", kind: "team" },
            ],
          },
        ],
      ]);
      const empty = yield* harness.call("update_pull_request", { url: PR_URL }).pipe(Effect.flip);
      expect(empty._tag).toBe("SourceControlInvalidRequestError");
    }),
  );

  it.effect("runs an action and reports the pull request's new state", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const result = yield* harness.call("act_on_pull_request", {
        url: PR_URL,
        action: "merge",
        mergeMethod: "squash",
      });
      expect(result).toMatchObject({ number: 5, action: "merge", state: "merged" });
      expect(yield* Ref.get(harness.calls)).toMatchObject([
        ["runAction", { action: "merge", mergeMethod: "squash", replyWithSummary: true }],
      ]);
    }),
  );

  it.effect("names the missing project when no project holds the pull request's repository", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const error = yield* harness
        .call("read_pull_request", { url: "https://github.com/other/repo/pull/1" })
        .pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "PullRequestProjectNotFoundError",
        repository: "other/repo",
      });
      expect(yield* Ref.get(harness.calls)).toEqual([]);
    }),
  );
});
