import type {
  CurrentBranchAction,
  GitStackedAction,
  QuickMergeAction,
  ThreadPullRequestLink,
  VcsStatusResult,
} from "@t3tools/contracts";
import { visibleThreadPullRequests } from "@t3tools/shared/threadPullRequests";

import type { EnvironmentThreadShell } from "./models.ts";
import { isThreadWorking } from "./threadInbox.ts";
import { effectiveSnoozed, type ThreadSnoozeShell } from "./threadSettled.ts";

/** Board columns, in the order they show. Every column is derived from state, never stored. */
export const BOARD_COLUMNS = [
  "draft",
  "working",
  "parked",
  "review",
  "pull_request",
  "done",
] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  draft: "Draft",
  working: "Working",
  parked: "Parked",
  review: "Review",
  pull_request: "In PR",
  done: "Done",
};

export type BoardThreadInput = ThreadSnoozeShell &
  Pick<
    EnvironmentThreadShell,
    | "hasActionableProposedPlan"
    | "interactionMode"
    | "latestRun"
    | "runtime"
    | "settledOverride"
    | "pullRequests"
  >;

/** The agent waits on you: an approval, a question, or a subagent's request. */
export function boardThreadNeedsYou(thread: BoardThreadInput): boolean {
  return (
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    thread.pendingSubagentRequest != null ||
    (thread.interactionMode === "plan" && thread.hasActionableProposedPlan)
  );
}

/** The thread's open or draft pull request; a link not synced yet counts as open, like the badge. */
export function boardOpenPullRequest(
  pullRequests: ReadonlyArray<ThreadPullRequestLink>,
): ThreadPullRequestLink | null {
  return (
    visibleThreadPullRequests(pullRequests).find(
      (link) => (link.snapshot?.state ?? "open") === "open",
    ) ?? null
  );
}

/** A thread nothing has run in yet is still a draft: its checkout's changes are not its own. */
export function resolveBoardColumn(
  thread: BoardThreadInput,
  options: { readonly now: string },
): BoardColumn {
  if (effectiveSnoozed(thread, options)) return "parked";
  if (thread.settledOverride === "settled") return "done";
  if (isThreadWorking(thread) || boardThreadNeedsYou(thread)) return "working";
  if (thread.latestRun === null) return "draft";
  if (boardOpenPullRequest(thread.pullRequests) !== null) return "pull_request";
  return "review";
}

export type BoardMove =
  | { readonly kind: "git"; readonly action: GitStackedAction; readonly label: string }
  | { readonly kind: "settle"; readonly label: string }
  | { readonly kind: "unsettle"; readonly label: string }
  | { readonly kind: "wake"; readonly label: string }
  | { readonly kind: "open"; readonly label: string }
  | { readonly kind: "open_pull_request"; readonly label: string; readonly url: string }
  | { readonly kind: "send_back"; readonly label: string };

export interface BoardForwardInput {
  readonly column: BoardColumn;
  readonly needsYou?: boolean;
  /** `undefined` while loading; `null` when the thread has no repository to act on. */
  readonly gitStatus: VcsStatusResult | null | undefined;
  readonly currentBranchAction: CurrentBranchAction;
  readonly quickMergeAction: QuickMergeAction;
  readonly openPullRequestUrl?: string | null;
}

const SETTLE: BoardMove = { kind: "settle", label: "Settle" };

/**
 * The step that moves a card to the next column. Review follows the project's workflow: a branch
 * merges into the default branch, or, with `currentBranchAction: pull_request`, opens a pull request.
 * Null when nothing moves it (a draft opens from its card, the agent is working) or git status is still loading.
 */
export function planBoardForward(input: BoardForwardInput): BoardMove | null {
  switch (input.column) {
    case "draft":
      return null;
    case "working":
      return input.needsYou ? { kind: "open", label: "Answer" } : null;
    case "pull_request":
      return input.openPullRequestUrl
        ? { kind: "open_pull_request", label: "Review PR", url: input.openPullRequestUrl }
        : null;
    case "done":
      return null;
    case "parked":
      return { kind: "wake", label: "Wake" };
    case "review":
      return planReviewForward(input);
  }
}

function planReviewForward(input: BoardForwardInput): BoardMove | null {
  const status = input.gitStatus;
  if (status === undefined) return null;
  if (status === null || !status.isRepo || status.refName === null || status.isDefaultRef) {
    return status?.isDefaultRef && status.hasWorkingTreeChanges
      ? { kind: "git", action: "commit", label: "Commit" }
      : SETTLE;
  }
  const dirty = status.hasWorkingTreeChanges;
  const ahead = (status.aheadOfDefaultCount ?? status.aheadCount) > 0;
  if (!dirty && !ahead) return SETTLE;
  if (input.currentBranchAction === "pull_request") {
    if (dirty) return { kind: "git", action: "commit_push_pr", label: "Commit, push & PR" };
    return { kind: "git", action: "create_pr", label: "Push & create PR" };
  }
  const andPush = input.quickMergeAction === "merge_push" && status.hasPrimaryRemote;
  const verb = andPush ? "merge & push" : "merge";
  // `merge` and `merge_push` commit pending changes first, so one step lands everything.
  return {
    kind: "git",
    action: andPush ? "merge_push" : "merge",
    label: dirty ? `Commit & ${verb}` : verb[0]!.toUpperCase() + verb.slice(1),
  };
}

/**
 * The column a step moves a card toward, so dropping the card there runs it. Navigation and a bare
 * commit move nothing, so no drop runs them.
 */
export function boardMoveTarget(move: BoardMove | null): BoardColumn | null {
  switch (move?.kind) {
    case "settle":
    case "git":
      if (move.kind === "git") {
        if (move.action === "create_pr" || move.action === "commit_push_pr") return "pull_request";
        if (move.action === "commit") return null;
      }
      return "done";
    case "unsettle":
    case "wake":
      return "review";
    default:
      return null;
  }
}

/** The step back: un-settle a done card, or send a reviewed one back to the agent. */
export function planBoardBack(column: BoardColumn): BoardMove | null {
  switch (column) {
    case "review":
    case "pull_request":
      return { kind: "send_back", label: "Send back" };
    case "done":
      return { kind: "unsettle", label: "Un-settle" };
    default:
      return null;
  }
}
