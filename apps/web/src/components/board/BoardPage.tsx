import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { projectKey } from "@t3tools/client-runtime/issue-projects";
import {
  BOARD_COLUMN_LABELS,
  BOARD_COLUMNS,
  resolveBoardColumn,
  type BoardColumn,
} from "@t3tools/client-runtime/state/board";
import {
  sortInboxThreadsByReturn,
  sortWorkingThreadsBySend,
} from "@t3tools/client-runtime/state/thread-inbox";
import { sortSettledThreads } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, LayersIcon } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { composerDraftHasUserContent, DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useSidebarProjectGroups } from "~/hooks/useSidebarProjectGroups";
import { useThreadActions } from "~/hooks/useThreadActions";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { cn } from "~/lib/utils";
import { useDelegatedUnderParent, useProjects, useVisibleThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";

import { filterSidebarV2VisibleThreads, useSnoozeWakeClock } from "../Sidebar.logic";
import { PullRequestCompactFilterMenu } from "../pullRequest/PullRequestCompactFilterMenu";
import type { PullRequestFilterOption } from "../pullRequest/PullRequestListFilters";
import { Button } from "../ui/button";
import { SidebarInset } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { isElectron } from "~/env";
import {
  BoardCardShell,
  BoardThreadCard,
  type BoardCardHandlers,
  type BoardDragData,
} from "./BoardCard";

const ALL_PROJECTS = "all";
/** The column narrow screens show; wider ones show every column. */
const NarrowColumnContext = createContext<BoardColumn>("review");

const dragTitle = (active: { data: { current?: unknown } }) =>
  (active.data.current as BoardDragData | undefined)?.title ?? "Card";
const columnLabel = (over: { id: string | number } | null) =>
  over ? (BOARD_COLUMN_LABELS[over.id as BoardColumn] ?? null) : null;
const dragAnnouncements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${dragTitle(active)}.`,
  onDragOver: ({ active, over }) =>
    columnLabel(over) ? `${dragTitle(active)} is over ${columnLabel(over)}.` : undefined,
  onDragEnd: ({ active, over }) =>
    columnLabel(over)
      ? `${dragTitle(active)} was dropped on ${columnLabel(over)}.`
      : `${dragTitle(active)} was dropped.`,
  onDragCancel: ({ active }) => `Moving ${dragTitle(active)} was cancelled.`,
};
/** Settled threads only pile up; the rest stay a click away. */
const DONE_LIMIT = 20;

function toastFailure(title: string, result: AtomCommandResult<unknown, unknown>) {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
  const error = squashAtomCommandFailure(result);
  toastManager.add({
    type: "error",
    title,
    description: error instanceof Error ? error.message : "An error occurred.",
  });
}

function BoardColumnView(props: {
  readonly column: BoardColumn;
  readonly count: number;
  readonly collapsed?: boolean;
  readonly onToggle?: () => void;
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.column });
  const label = BOARD_COLUMN_LABELS[props.column];
  const narrowActive = useContext(NarrowColumnContext) === props.column;
  // Narrow screens show the picked column alone, so it opens even when collapsed.
  const collapsed = props.collapsed && !narrowActive;
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-testid={`board-column-${props.column}`}
      className={cn(
        "max-h-full w-full shrink-0 snap-start flex-col rounded-xl bg-muted/40 md:flex md:w-72",
        narrowActive ? "flex" : "hidden",
        isOver && "ring-2 ring-ring",
      )}
    >
      <header className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 text-sm font-medium">
        {props.onToggle ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1"
            aria-expanded={!collapsed}
            onClick={props.onToggle}
          >
            {collapsed ? (
              <ChevronRightIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
            {label}
          </button>
        ) : (
          <h2>{label}</h2>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{props.count}</span>
      </header>
      {collapsed ? null : (
        <ul className="flex min-h-12 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {props.children}
          {props.footer}
        </ul>
      )}
    </section>
  );
}

function useBoardDrafts(scopedKey: string | null) {
  const sessions = useComposerDraftStore((store) => store.draftThreadsByThreadKey);
  const composers = useComposerDraftStore(
    useShallow((store) =>
      Object.fromEntries(
        Object.keys(store.draftThreadsByThreadKey).map(
          (key) => [key, store.draftsByThreadKey[key]] as const,
        ),
      ),
    ),
  );
  return Object.entries(sessions)
    .flatMap(([key, session]) => {
      const composer = composers[key];
      if (session.promotedTo != null || !composer || !composerDraftHasUserContent(composer)) {
        return [];
      }
      if (scopedKey !== null && `${session.environmentId}:${session.projectId}` !== scopedKey) {
        return [];
      }
      const text =
        replaceComposerContextReferences(composer.prompt, (occurrence) => occurrence.label)
          .trim()
          .split("\n", 1)[0] ?? "";
      return [{ draftId: DraftId.make(key), session, title: text || "Draft with attachments" }];
    })
    .toSorted((left, right) => right.session.createdAt.localeCompare(left.session.createdAt));
}

export function BoardPage() {
  const search = useSearch({ from: "/_chat/board" });
  const navigate = useNavigate();
  const projects = useProjects();
  const threads = useVisibleThreadShells();
  const delegatedUnderParent = useDelegatedUnderParent();
  const { settleThread, unsettleThread, unsnoozeThread } = useThreadActions();
  const openPrLink = useOpenPrLink();
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [narrowColumn, setNarrowColumn] = useState<BoardColumn>("review");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const scopedKey =
    search.environmentId && search.projectId ? `${search.environmentId}:${search.projectId}` : null;
  const visible = filterSidebarV2VisibleThreads(
    threads,
    scopedKey === null ? null : new Set([scopedKey]),
    delegatedUnderParent,
  ).filter((thread) => thread.deletedAt === null);
  const clockMs = useSnoozeWakeClock(visible);
  const now = new Date(clockMs).toISOString();
  const projectByKey = new Map(projects.map((project) => [projectKey(project), project]));
  const projectNameByKey = new Map(
    useSidebarProjectGroups().flatMap((group) =>
      group.memberProjects.map((project) => [projectKey(project), group.displayName] as const),
    ),
  );
  const drafts = useBoardDrafts(scopedKey);

  const byColumn = new Map<BoardColumn, EnvironmentThreadShell[]>();
  for (const thread of visible) {
    const column = resolveBoardColumn(thread, { now });
    byColumn.set(column, [...(byColumn.get(column) ?? []), thread]);
  }
  const sorted: Record<BoardColumn, EnvironmentThreadShell[]> = {
    draft: (byColumn.get("draft") ?? []).toSorted((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
    working: sortWorkingThreadsBySend(byColumn.get("working") ?? []),
    review: sortInboxThreadsByReturn(byColumn.get("review") ?? []),
    pull_request: sortInboxThreadsByReturn(byColumn.get("pull_request") ?? []),
    done: sortSettledThreads(byColumn.get("done") ?? []),
    parked: (byColumn.get("parked") ?? []).toSorted((left, right) =>
      (left.snoozedUntil ?? "").localeCompare(right.snoozedUntil ?? ""),
    ),
  };

  const columnCount = (column: BoardColumn) =>
    sorted[column].length + (column === "draft" ? drafts.length : 0);

  const openThread = (thread: EnvironmentThreadShell) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
    });
  const handlers: BoardCardHandlers = {
    onOpen: openThread,
    onMove: async (thread, move, event) => {
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      switch (move.kind) {
        case "settle":
          return toastFailure("Failed to settle thread", await settleThread(ref));
        case "unsettle":
          return toastFailure("Failed to un-settle thread", await unsettleThread(ref));
        case "wake":
          return toastFailure("Failed to wake thread", await unsnoozeThread(ref));
        case "open_pull_request":
          if (event) openPrLink(event, move.url, ref);
          else window.open(move.url, "_blank", "noopener,noreferrer");
          return;
        case "open":
        case "send_back":
          return openThread(thread);
      }
    },
  };

  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as BoardDragData | undefined;
    data?.moves.find((move) => move.target === event.over?.id)?.run();
  };

  const projectOptions: ReadonlyArray<PullRequestFilterOption<string>> = [
    { value: ALL_PROJECTS, label: "All projects", Icon: LayersIcon },
    ...projects.map((project) => ({
      value: projectKey(project),
      label: projectNameByKey.get(projectKey(project)) ?? project.title,
      Icon: FolderIcon,
      project,
    })),
  ];
  const doneThreads = doneExpanded ? sorted.done : sorted.done.slice(0, DONE_LIMIT);
  const threadCards = (column: BoardColumn, list: EnvironmentThreadShell[]) =>
    list.map((thread) => {
      const key = `${thread.environmentId}:${thread.projectId}`;
      return (
        <BoardThreadCard
          key={`${thread.environmentId}:${thread.id}`}
          thread={thread}
          column={column}
          project={projectByKey.get(key) ?? null}
          projectName={projectNameByKey.get(key) ?? null}
          handlers={handlers}
        />
      );
    });

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <WorkspacePageHeader electron={isElectron} className="border-b">
        <WorkspaceBreadcrumb ariaLabel="Board breadcrumb" className="shrink">
          <WorkspaceBreadcrumbItem current>
            <h1 className="truncate">Board</h1>
          </WorkspaceBreadcrumbItem>
        </WorkspaceBreadcrumb>
        <div className="min-w-0 flex-1" />
        <PullRequestCompactFilterMenu
          label="Project"
          outlined
          value={scopedKey ?? ALL_PROJECTS}
          options={projectOptions}
          onChange={(value) => {
            const project = projectByKey.get(value);
            void navigate({
              to: "/board",
              search: project
                ? {
                    environmentId: project.environmentId as EnvironmentId,
                    projectId: project.id as ProjectId,
                  }
                : {},
            });
          }}
        />
      </WorkspacePageHeader>
      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: dragAnnouncements }}
      >
        <div
          role="tablist"
          aria-label="Board columns"
          className="flex shrink-0 gap-1 overflow-x-auto px-3 pt-3 md:hidden"
        >
          {BOARD_COLUMNS.map((column) => (
            <Button
              key={column}
              role="tab"
              aria-selected={column === narrowColumn}
              size="xs"
              variant={column === narrowColumn ? "secondary" : "ghost"}
              onClick={() => setNarrowColumn(column)}
            >
              {BOARD_COLUMN_LABELS[column]}
              <span className="text-muted-foreground tabular-nums">{columnCount(column)}</span>
            </Button>
          ))}
        </div>
        <NarrowColumnContext value={narrowColumn}>
          <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto p-3">
            <BoardColumnView column="draft" count={drafts.length + sorted.draft.length}>
              {threadCards("draft", sorted.draft)}
              {drafts.map((draft) => {
                const open = () =>
                  void navigate({ to: "/draft/$draftId", params: { draftId: draft.draftId } });
                return (
                  <BoardCardShell
                    key={draft.draftId}
                    dragId={`draft:${draft.draftId}`}
                    dragData={{ title: draft.title, moves: [] }}
                    title={draft.title}
                    ariaLabel={`Open draft ${draft.title}`}
                    project={
                      projectByKey.get(
                        `${draft.session.environmentId}:${draft.session.projectId}`,
                      ) ?? null
                    }
                    projectName={
                      projectNameByKey.get(
                        `${draft.session.environmentId}:${draft.session.projectId}`,
                      ) ?? null
                    }
                    onOpen={open}
                    actions={
                      <>
                        <span />
                        <Button size="xs" variant="outline" onClick={open}>
                          Open draft
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </BoardColumnView>
            <BoardColumnView column="working" count={sorted.working.length}>
              {threadCards("working", sorted.working)}
            </BoardColumnView>
            <BoardColumnView column="review" count={sorted.review.length}>
              {threadCards("review", sorted.review)}
            </BoardColumnView>
            <BoardColumnView column="pull_request" count={sorted.pull_request.length}>
              {threadCards("pull_request", sorted.pull_request)}
            </BoardColumnView>
            <BoardColumnView
              column="done"
              count={sorted.done.length}
              footer={
                sorted.done.length > DONE_LIMIT ? (
                  <li className="list-none">
                    <Button
                      size="xs"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setDoneExpanded((value) => !value)}
                    >
                      {doneExpanded ? "Show fewer" : `Show ${sorted.done.length - DONE_LIMIT} more`}
                    </Button>
                  </li>
                ) : null
              }
            >
              {threadCards("done", doneThreads)}
            </BoardColumnView>
            <BoardColumnView
              column="parked"
              count={sorted.parked.length}
              collapsed={!parkedOpen}
              onToggle={() => setParkedOpen((value) => !value)}
            >
              {threadCards("parked", sorted.parked)}
            </BoardColumnView>
          </div>
        </NarrowColumnContext>
      </DndContext>
    </SidebarInset>
  );
}
