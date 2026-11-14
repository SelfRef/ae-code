import type { ThreadPullRequestLink, VcsStatusResult } from "@t3tools/contracts";
import { ProviderInstanceId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  boardMoveTarget,
  planBoardBack,
  planBoardForward,
  resolveBoardColumn,
  type BoardForwardInput,
  type BoardThreadInput,
} from "./board.ts";

const NOW = "2026-06-01T12:00:00.000Z";

function pr(state: "open" | "closed" | "merged" | null): ThreadPullRequestLink {
  return {
    host: "github.com",
    repository: "o/r",
    number: 1,
    url: "https://github.com/o/r/pull/1",
    source: "created",
    linkedAt: NOW,
    snapshot:
      state === null
        ? null
        : {
            state,
            title: "t",
            headBranch: "h",
            baseBranch: "main",
            isDraft: false,
            updatedAt: NOW,
            syncedAt: NOW,
          },
    stack: null,
  };
}

function thread(overrides: Partial<BoardThreadInput> = {}): BoardThreadInput {
  return {
    hasActionableProposedPlan: false,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    interactionMode: "default",
    latestRun: null,
    runtime: null,
    settledOverride: null,
    snoozedUntil: null,
    pullRequests: [],
    ...overrides,
  };
}

const finished: NonNullable<BoardThreadInput["latestRun"]> = {
  runId: RunId.make("run-1"),
  status: "completed",
  requestedAt: NOW,
  startedAt: NOW,
  completedAt: NOW,
  assistantMessageId: null,
};

const running = {
  status: "running" as const,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: NOW,
};

describe("resolveBoardColumn", () => {
  it.each([
    ["never ran", thread(), "draft"],
    ["finished", thread({ latestRun: finished }), "review"],
    ["running", thread({ runtime: running }), "working"],
    ["waiting on an approval", thread({ hasPendingApprovals: true }), "working"],
    ["settled", thread({ settledOverride: "settled", runtime: running }), "done"],
    ["snoozed", thread({ snoozedUntil: "2026-06-02T00:00:00.000Z" }), "parked"],
    [
      "snooze expired",
      thread({ latestRun: finished, snoozedUntil: "2026-06-01T00:00:00.000Z" }),
      "review",
    ],
    [
      "open pull request",
      thread({ latestRun: finished, pullRequests: [pr("open")] }),
      "pull_request",
    ],
    [
      "unsynced pull request",
      thread({ latestRun: finished, pullRequests: [pr(null)] }),
      "pull_request",
    ],
    [
      "merged pull request",
      thread({ latestRun: finished, pullRequests: [pr("merged")] }),
      "review",
    ],
    [
      "running with a pull request",
      thread({ runtime: running, pullRequests: [pr("open")] }),
      "working",
    ],
  ] as const)("%s", (_name, input, expected) => {
    expect(resolveBoardColumn(input, { now: NOW })).toBe(expected);
  });
});

function status(overrides: Partial<VcsStatusResult> = {}): VcsStatusResult {
  return {
    isRepo: true,
    hasPrimaryRemote: true,
    isDefaultRef: false,
    refName: "t3/feature",
    hasWorkingTreeChanges: false,
    workingTree: { files: [], insertions: 0, deletions: 0 },
    hasUpstream: false,
    aheadCount: 0,
    behindCount: 0,
    aheadOfDefaultCount: 0,
    pr: null,
    ...overrides,
  };
}

function review(
  gitStatus: VcsStatusResult | null | undefined,
  overrides: Partial<BoardForwardInput> = {},
): BoardForwardInput {
  return {
    column: "review",
    gitStatus,
    currentBranchAction: "push",
    quickMergeAction: "merge",
    ...overrides,
  };
}

describe("planBoardForward", () => {
  it.each([
    ["loading", review(undefined), null],
    ["no repository", review(null), "settle"],
    ["nothing to land", review(status()), "settle"],
    ["dirty branch", review(status({ hasWorkingTreeChanges: true })), "git:merge:Commit & merge"],
    ["ahead", review(status({ aheadOfDefaultCount: 2 })), "git:merge:Merge"],
    [
      "ahead, merge & push",
      review(status({ aheadOfDefaultCount: 2 }), { quickMergeAction: "merge_push" }),
      "git:merge_push:Merge & push",
    ],
    [
      "merge & push without a remote",
      review(status({ aheadOfDefaultCount: 2, hasPrimaryRemote: false }), {
        quickMergeAction: "merge_push",
      }),
      "git:merge:Merge",
    ],
    [
      "pull request flow, dirty",
      review(status({ hasWorkingTreeChanges: true }), { currentBranchAction: "pull_request" }),
      "git:commit_push_pr:Commit, push & PR",
    ],
    [
      "pull request flow, ahead",
      review(status({ aheadOfDefaultCount: 1 }), { currentBranchAction: "pull_request" }),
      "git:create_pr:Push & create PR",
    ],
    [
      "on the default branch with edits",
      review(status({ isDefaultRef: true, hasWorkingTreeChanges: true })),
      "git:commit:Commit",
    ],
    ["draft", { ...review(status()), column: "draft" }, null],
    ["working", { ...review(status()), column: "working" }, null],
    ["needs you", { ...review(status()), column: "working", needsYou: true }, "open"],
    ["parked", { ...review(status()), column: "parked" }, "wake"],
    ["done", { ...review(status()), column: "done" }, null],
    [
      "in a pull request",
      { ...review(status()), column: "pull_request", openPullRequestUrl: "https://x/pull/1" },
      "open_pull_request",
    ],
  ] as const)("%s", (_name, input, expected) => {
    const move = planBoardForward(input);
    expect(
      move === null ? null : move.kind === "git" ? `git:${move.action}:${move.label}` : move.kind,
    ).toBe(expected);
  });
});

describe("boardMoveTarget", () => {
  it.each([
    [{ kind: "settle", label: "" }, "done"],
    [{ kind: "git", action: "merge", label: "" }, "done"],
    [{ kind: "git", action: "create_pr", label: "" }, "pull_request"],
    [{ kind: "git", action: "commit", label: "" }, null],
    [{ kind: "unsettle", label: "" }, "review"],
    [{ kind: "wake", label: "" }, "review"],
    [{ kind: "send_back", label: "" }, null],
    [null, null],
  ] as const)("%o", (move, expected) => {
    expect(boardMoveTarget(move)).toBe(expected);
  });
});

describe("planBoardBack", () => {
  it.each([
    ["review", "send_back"],
    ["pull_request", "send_back"],
    ["done", "unsettle"],
    ["working", null],
    ["draft", null],
    ["parked", null],
  ] as const)("%s", (column, expected) => {
    expect(planBoardBack(column)?.kind ?? null).toBe(expected);
  });
});
