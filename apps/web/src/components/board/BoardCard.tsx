import { useDraggable } from "@dnd-kit/core";
import {
  boardMoveTarget,
  boardOpenPullRequest,
  boardThreadNeedsYou,
  planBoardBack,
  planBoardForward,
  type BoardColumn,
  type BoardMove,
} from "@t3tools/client-runtime/state/board";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { GitRunStackedActionResult } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon, GitBranchIcon } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";

import { useCurrentBranchAction, useQuickMergeAction } from "~/hooks/useSettings";
import { cn, randomUUID } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { useGitStackedAction } from "~/state/sourceControlActions";
import { vcsEnvironment } from "~/state/vcs";

import { ProjectFavicon } from "../ProjectFavicon";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { toastManager } from "../ui/toast";

/** What a card's buttons call; the page owns the thread commands and navigation. */
export interface BoardCardHandlers {
  readonly onOpen: (thread: EnvironmentThreadShell) => void;
  readonly onMove: (
    thread: EnvironmentThreadShell,
    move: Exclude<BoardMove, { kind: "git" }>,
    event: MouseEvent<HTMLElement> | null,
  ) => Promise<void>;
}

/** The steps a dragged card can take, each with the column a drop must land on to run it. */
export interface BoardDragData {
  readonly title: string;
  readonly moves: ReadonlyArray<{ readonly target: BoardColumn; readonly run: () => void }>;
}

function toastFailure(title: string, result: AtomCommandResult<unknown, unknown>) {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
  const error = squashAtomCommandFailure(result);
  toastManager.add({
    type: "error",
    title,
    description: error instanceof Error ? error.message : "An error occurred.",
  });
}

export function BoardCardShell(props: {
  readonly dragId: string;
  readonly dragData: BoardDragData;
  readonly title: string;
  readonly ariaLabel: string;
  readonly project: EnvironmentProject | null;
  readonly projectName: string | null;
  readonly meta?: ReactNode;
  readonly badges?: ReactNode;
  readonly actions: ReactNode;
  readonly onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.dragId,
    data: props.dragData,
  });
  return (
    <li
      ref={setNodeRef}
      data-testid="board-card"
      className={cn(
        "list-none rounded-lg border bg-card p-2.5 shadow-xs/5",
        isDragging && "opacity-50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={props.ariaLabel}
        className="cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={props.onOpen}
        onKeyDown={(event) => {
          // Keyboard moves go through the buttons; only the pointer drags.
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onOpen();
          }
        }}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {props.project ? (
            <ProjectFavicon project={props.project} className="size-3.5 shrink-0" />
          ) : null}
          <span className="min-w-0 truncate">
            {props.projectName ?? props.project?.title ?? "No project"}
          </span>
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-medium break-words">{props.title}</div>
        {props.meta ? (
          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            {props.meta}
          </div>
        ) : null}
        {props.badges ? <div className="mt-1.5 flex flex-wrap gap-1">{props.badges}</div> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1.5">{props.actions}</div>
    </li>
  );
}

function MoveButton(props: {
  readonly move: BoardMove | null;
  readonly direction: "forward" | "back";
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly onClick: (event: MouseEvent<HTMLElement>) => void;
}) {
  if (props.move === null) return <span />;
  const forward = props.direction === "forward";
  return (
    <Button
      size="xs"
      variant={forward ? "outline" : "ghost"}
      disabled={props.busy || props.disabled}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick(event);
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {!forward ? <ArrowLeftIcon /> : null}
      {props.busy && forward ? <Spinner /> : null}
      {props.move.label}
      {forward ? <ArrowRightIcon /> : null}
    </Button>
  );
}

const CHECKS_LABEL = { passing: "Checks pass", failing: "Checks fail", pending: "Checks running" };
const REVIEW_LABEL = {
  approved: "Approved",
  "changes-requested": "Changes requested",
  "review-required": "Review required",
} as const;

export function BoardThreadCard(props: {
  readonly thread: EnvironmentThreadShell;
  readonly column: BoardColumn;
  readonly project: EnvironmentProject | null;
  readonly projectName: string | null;
  readonly handlers: BoardCardHandlers;
}) {
  const { thread, column, project, projectName, handlers } = props;
  const cwd = thread.worktreePath ?? project?.workspaceRoot ?? null;
  const scope = { environmentId: thread.environmentId, cwd };
  const gitStatusQuery = useEnvironmentQuery(
    column === "review" && cwd !== null
      ? vcsEnvironment.status({ environmentId: thread.environmentId, input: { cwd } })
      : null,
  );
  const gitAction = useGitStackedAction(scope);
  const currentBranchAction = useCurrentBranchAction(thread.environmentId, thread.projectId);
  const quickMergeAction = useQuickMergeAction(thread.environmentId, thread.projectId);
  const [pending, setPending] = useState(false);
  const needsYou = boardThreadNeedsYou(thread);
  const openPullRequest = boardOpenPullRequest(thread.pullRequests);
  const forward = planBoardForward({
    column,
    needsYou,
    gitStatus: cwd === null ? null : gitStatusQuery.data,
    currentBranchAction,
    quickMergeAction,
    openPullRequestUrl: openPullRequest?.url ?? null,
  });
  const back = planBoardBack(column);
  const busy = pending || gitAction.isPending;

  const perform = async (move: BoardMove, event: MouseEvent<HTMLElement> | null) => {
    if (move.kind !== "git") return handlers.onMove(thread, move, event);
    const result = await gitAction.run({
      actionId: randomUUID(),
      action: move.action,
      threadId: thread.id,
    });
    if (result._tag === "Failure") return toastFailure("Action failed", result);
    const value: GitRunStackedActionResult = result.value;
    toastManager.add({
      type: "success",
      title: value.toast.title,
      ...(value.toast.description ? { description: value.toast.description } : {}),
    });
  };
  const run = (move: BoardMove, event: MouseEvent<HTMLElement> | null) => {
    setPending(true);
    return perform(move, event).finally(() => setPending(false));
  };

  const failed = thread.latestRun?.status === "failed" || thread.runtime?.lastError != null;
  const snapshot = openPullRequest?.snapshot ?? null;
  const badges = [
    needsYou ? (
      <Badge key="needs" variant="warning" size="sm">
        <CircleAlertIcon />
        Needs you
      </Badge>
    ) : null,
    failed && column !== "done" ? (
      <Badge key="failed" variant="error" size="sm">
        Failed
      </Badge>
    ) : null,
    openPullRequest ? (
      <Badge key="pr" variant="outline" size="sm">
        {snapshot?.isDraft ? <PullRequestGlyph.draft /> : <PullRequestGlyph.pullRequest />}#
        {openPullRequest.number}
      </Badge>
    ) : null,
    snapshot?.checksState ? (
      <Badge
        key="checks"
        size="sm"
        variant={
          snapshot.checksState === "passing"
            ? "success"
            : snapshot.checksState === "failing"
              ? "error"
              : "info"
        }
      >
        {CHECKS_LABEL[snapshot.checksState]}
      </Badge>
    ) : null,
    snapshot?.reviewDecision ? (
      <Badge
        key="review"
        size="sm"
        variant={snapshot.reviewDecision === "approved" ? "success" : "secondary"}
      >
        {REVIEW_LABEL[snapshot.reviewDecision]}
      </Badge>
    ) : null,
    snapshot?.mergeability === "conflicting" ? (
      <Badge key="conflict" variant="error" size="sm">
        Conflicts
      </Badge>
    ) : null,
  ].filter(Boolean);

  return (
    <BoardCardShell
      dragId={`thread:${thread.environmentId}:${thread.id}`}
      dragData={{
        title: thread.title,
        moves: busy
          ? []
          : [forward, back].flatMap((move) => {
              const target = boardMoveTarget(move);
              return move && target ? [{ target, run: () => void run(move, null) }] : [];
            }),
      }}
      title={thread.title}
      ariaLabel={`Open ${thread.title}`}
      project={project}
      projectName={projectName}
      meta={
        thread.branch ? (
          <>
            <GitBranchIcon aria-hidden className="size-3 shrink-0" />
            <span className="min-w-0 truncate font-mono">{thread.branch}</span>
          </>
        ) : undefined
      }
      badges={badges.length > 0 ? badges : undefined}
      onOpen={() => handlers.onOpen(thread)}
      actions={
        <>
          <MoveButton
            move={back}
            direction="back"
            busy={busy}
            onClick={(event) => back && void run(back, event)}
          />
          <MoveButton
            move={forward}
            direction="forward"
            busy={busy}
            disabled={forward?.kind === "git" && !gitAction.isAllowed}
            onClick={(event) => forward && void run(forward, event)}
          />
        </>
      }
    />
  );
}
