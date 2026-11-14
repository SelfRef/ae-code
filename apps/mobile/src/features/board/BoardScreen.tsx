import {
  BOARD_COLUMN_LABELS,
  BOARD_COLUMNS,
  boardOpenPullRequest,
  boardThreadNeedsYou,
  planBoardBack,
  planBoardForward,
  resolveBoardColumn,
  type BoardColumn,
  type BoardMove,
} from "@t3tools/client-runtime/state/board";
import { projectKey } from "@t3tools/client-runtime/issue-projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import {
  sortInboxThreadsByReturn,
  sortWorkingThreadsBySend,
} from "@t3tools/client-runtime/state/thread-inbox";
import { sortSettledThreads } from "@t3tools/client-runtime/state/thread-sort";
import {
  AuthSourceControlWriteScope,
  DEFAULT_SERVER_SETTINGS,
  type EnvironmentId,
  isListedThreadLineage,
} from "@t3tools/contracts";
import { copySorted } from "@t3tools/shared/Array";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView as RowScrollView,
  View,
  useWindowDimensions,
} from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import * as Dialog from "../../components/ui/Dialog";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useNowMinuteMs } from "../../lib/clock";
import { uuidv4 } from "../../lib/uuid";
import { useOpenPullRequest } from "../../native/useOpenPullRequest";
import {
  useEnvironmentServerConfig,
  useNavigationThreadShells,
  useProjects,
} from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentScope } from "../../state/session";
import { usePendingNewTasks, type PendingNewTask } from "../../state/use-pending-new-tasks";
import { useAtomCommand } from "../../state/use-atom-command";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { vcsActionManager, vcsEnvironment } from "../../state/vcs";
import { useThreadListActions } from "../home/useThreadListActions";
import { usePendingTaskListActions } from "../home/usePendingTaskListActions";
import { SymbolView } from "../../components/ui/AppSymbol";
import { ListFilterMenu } from "../layout/workspace/ListFilterMenu";
import { projectIcon } from "../layout/workspace/ProjectChoiceChip";
import { useSelectWorkspaceDetail } from "../layout/workspace/useSelectWorkspaceDetail";
import { SettingsScreen } from "../settings/components/SettingsScreen";

const allProjectsIcon = (size: number) => (
  <SymbolView name="square.grid.2x2" size={size} tintColorClassName="accent-icon-subtle" />
);
/** Settled threads only pile up; the rest stay a tap away. */
const DONE_LIMIT = 20;
const WIDE_BOARD_WIDTH = 700;

type MoveHandler = (
  thread: EnvironmentThreadShell,
  move: Exclude<BoardMove, { kind: "git" }>,
) => Promise<void>;

function alertFailure(title: string, result: AtomCommandResult<unknown, unknown>) {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
  const cause = squashAtomCommandFailure(result);
  Dialog.alert(title, cause instanceof Error ? cause.message : "Try again.");
}

function CardFrame(props: {
  readonly project: EnvironmentProject | null;
  /** The machine, when cards from more than one could look alike. */
  readonly machine?: string | null;
  readonly title: string;
  readonly meta?: string | null;
  readonly badges?: ReadonlyArray<string>;
  readonly onOpen: () => void;
  readonly back?: { readonly label: string; readonly onPress: () => void } | null;
  readonly forward?: {
    readonly label: string;
    readonly onPress: () => void;
    readonly disabled?: boolean;
    readonly loading?: boolean;
  } | null;
}) {
  return (
    <View className="mb-2 gap-1 rounded-xl border border-border bg-card px-3 py-2">
      <Pressable accessibilityRole="button" onPress={props.onOpen} className="active:opacity-70">
        <Text textRole="caption" className="text-foreground-muted" numberOfLines={1}>
          {[props.project?.title ?? "No project", props.machine].filter(Boolean).join(" · ")}
        </Text>
        <Text textRole="body" className="font-t3-bold" numberOfLines={2}>
          {props.title}
        </Text>
        {props.meta ? (
          <Text textRole="caption" className="text-foreground-muted" numberOfLines={1}>
            {props.meta}
          </Text>
        ) : null}
        {props.badges && props.badges.length > 0 ? (
          <Text textRole="caption" className="text-warning-foreground" numberOfLines={1}>
            {props.badges.join(" · ")}
          </Text>
        ) : null}
      </Pressable>
      {props.back || props.forward ? (
        <View className="flex-row items-center justify-between">
          {props.back ? (
            <Button
              label={props.back.label}
              icon="arrow.left"
              tone="text"
              size="compact"
              onPress={props.back.onPress}
            />
          ) : (
            <View />
          )}
          {props.forward ? (
            <Button
              label={props.forward.label}
              tone="secondary"
              size="compact"
              onPress={props.forward.onPress}
              disabled={props.forward.disabled ?? false}
              loading={props.forward.loading ?? false}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const CHECKS_LABEL = { passing: "Checks pass", failing: "Checks fail", pending: "Checks running" };
const REVIEW_LABEL = {
  approved: "Approved",
  "changes-requested": "Changes requested",
  "review-required": "Review required",
} as const;

function BoardThreadCard(props: {
  readonly thread: EnvironmentThreadShell;
  readonly column: BoardColumn;
  readonly project: EnvironmentProject | null;
  readonly machine: string | null;
  readonly onOpen: (thread: EnvironmentThreadShell) => void;
  readonly onMove: MoveHandler;
}) {
  const { thread, column, project } = props;
  const cwd = thread.worktreePath ?? project?.workspaceRoot ?? null;
  const gitStatus = useEnvironmentQuery(
    column === "review" && cwd !== null
      ? vcsEnvironment.status({ environmentId: thread.environmentId, input: { cwd } })
      : null,
  );
  const runStackedAction = useAtomCommand(
    vcsActionManager.runStackedAction({ environmentId: thread.environmentId, cwd }),
    { reportFailure: false },
  );
  const canWrite = useEnvironmentScope(thread.environmentId, AuthSourceControlWriteScope);
  const serverConfig = useEnvironmentServerConfig(thread.environmentId);
  const settings = resolveProjectSettings(
    serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS,
    thread.projectId,
  ).settings;
  const openPullRequestInApp = useOpenPullRequest({
    context: { environmentId: String(thread.environmentId), projectId: String(thread.projectId) },
  });
  const [pending, setPending] = useState(false);
  const needsYou = boardThreadNeedsYou(thread);
  const openPullRequest = boardOpenPullRequest(thread.pullRequests);
  const forward = planBoardForward({
    column,
    needsYou,
    gitStatus: cwd === null ? null : gitStatus.data,
    currentBranchAction: settings.currentBranchAction,
    quickMergeAction: settings.quickMergeAction,
    openPullRequestUrl: openPullRequest?.url ?? null,
  });
  const back = planBoardBack(column);

  const perform = async (move: BoardMove) => {
    if (move.kind === "open_pull_request") {
      if (!(await openPullRequestInApp(move.url))) await Linking.openURL(move.url);
      return;
    }
    if (move.kind !== "git") return props.onMove(thread, move);
    const result = await runStackedAction({
      actionId: uuidv4(),
      action: move.action,
      threadId: thread.id,
    });
    if (result._tag === "Failure") alertFailure("Action failed", result);
  };
  const run = (move: BoardMove) => {
    setPending(true);
    void perform(move).finally(() => setPending(false));
  };

  const snapshot = openPullRequest?.snapshot ?? null;
  const failed = thread.latestRun?.status === "failed" || thread.runtime?.lastError != null;
  const badges = [
    needsYou ? "Needs you" : null,
    failed && column !== "done" ? "Failed" : null,
    openPullRequest ? `${snapshot?.isDraft ? "Draft PR" : "PR"} #${openPullRequest.number}` : null,
    snapshot?.checksState ? CHECKS_LABEL[snapshot.checksState] : null,
    snapshot?.reviewDecision ? REVIEW_LABEL[snapshot.reviewDecision] : null,
    snapshot?.mergeability === "conflicting" ? "Conflicts" : null,
  ].filter((badge): badge is string => badge !== null);

  return (
    <CardFrame
      project={project}
      machine={props.machine}
      title={thread.title}
      meta={thread.branch}
      badges={badges}
      onOpen={() => props.onOpen(thread)}
      back={back ? { label: back.label, onPress: () => run(back) } : null}
      forward={
        forward
          ? {
              label: forward.label,
              onPress: () => run(forward),
              disabled: pending || (forward.kind === "git" && !canWrite),
              loading: pending,
            }
          : null
      }
    />
  );
}

/** The Board tab: threads in derived columns, one column at a time, with forward and back steps. */
export function BoardScreen() {
  const projects = useProjects();
  const threads = useNavigationThreadShells();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const machineOf = (environmentId: EnvironmentId) =>
    Object.keys(savedConnectionsById).length > 1
      ? (savedConnectionsById[environmentId]?.environmentLabel ?? null)
      : null;
  // A tablet pane fits several columns side by side; a phone shows one behind tabs.
  const wide = useWindowDimensions().width >= WIDE_BOARD_WIDTH;
  const pendingTasks = usePendingNewTasks();
  const selectDetail = useSelectWorkspaceDetail();
  const { openPendingTask } = usePendingTaskListActions((params) =>
    selectDetail({ name: "Thread", params }),
  );
  const { settleThread, unsettleThread, unsnoozeThread } = useThreadListActions();
  const [column, setColumn] = useState<BoardColumn>("review");
  // Project keys the board shows; empty means every project.
  const [scope, setScope] = useState<ReadonlyArray<string>>([]);
  // Parked starts collapsed: it holds what you chose to look at later.
  const [collapsed, setCollapsed] = useState<ReadonlySet<BoardColumn>>(new Set(["parked"]));
  const [doneExpanded, setDoneExpanded] = useState(false);
  // Snoozes ending while no thread changes show up within a minute.
  const now = new Date(useNowMinuteMs()).toISOString();
  const projectByKey = new Map(projects.map((project) => [projectKey(project), project]));
  const inScope = (environmentId: string, projectId: string) =>
    scope.length === 0 || scope.includes(`${environmentId}:${projectId}`);

  const byColumn = new Map<BoardColumn, EnvironmentThreadShell[]>();
  for (const thread of threads) {
    if (thread.deletedAt !== null || !isListedThreadLineage(thread.lineage)) continue;
    if (!inScope(thread.environmentId, thread.projectId)) continue;
    const target = resolveBoardColumn(thread, { now });
    byColumn.set(target, [...(byColumn.get(target) ?? []), thread]);
  }
  const drafts = pendingTasks.filter(
    (task): task is Extract<PendingNewTask, { kind: "draft" }> =>
      task.kind === "draft" && inScope(task.environmentId, task.projectId),
  );
  const sorted: Record<BoardColumn, EnvironmentThreadShell[]> = {
    draft: copySorted(byColumn.get("draft") ?? [], (a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    working: sortWorkingThreadsBySend(byColumn.get("working") ?? []),
    review: sortInboxThreadsByReturn(byColumn.get("review") ?? []),
    pull_request: sortInboxThreadsByReturn(byColumn.get("pull_request") ?? []),
    done: sortSettledThreads(byColumn.get("done") ?? []),
    parked: copySorted(byColumn.get("parked") ?? [], (a, b) =>
      (a.snoozedUntil ?? "").localeCompare(b.snoozedUntil ?? ""),
    ),
  };
  const count = (target: BoardColumn) =>
    sorted[target].length + (target === "draft" ? drafts.length : 0);

  const openThread = (thread: EnvironmentThreadShell) =>
    selectDetail({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
  const onMove: MoveHandler = async (thread, move) => {
    switch (move.kind) {
      case "settle":
        await settleThread(thread);
        return;
      case "unsettle":
        await unsettleThread(thread);
        return;
      case "wake":
        await unsnoozeThread(thread);
        return;
      default:
        openThread(thread);
    }
  };

  const scopedProjects = scope.flatMap((key) => projectByKey.get(key) ?? []);
  const [onlyProject] = scopedProjects;
  const toggleScope = (key: string) =>
    setScope((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  const toggleCollapsed = (target: BoardColumn) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(target)) next.add(target);
      return next;
    });
  const columnCards = (target: BoardColumn) => {
    const list =
      target === "done" && !doneExpanded ? sorted.done.slice(0, DONE_LIMIT) : sorted[target];
    return (
      <>
        {count(target) === 0 ? (
          <Text textRole="footnote" className="py-3 text-foreground-muted">
            Nothing in {BOARD_COLUMN_LABELS[target]}.
          </Text>
        ) : null}
        {list.map((thread) => (
          <BoardThreadCard
            key={`${thread.environmentId}:${thread.id}`}
            thread={thread}
            column={target}
            project={projectByKey.get(`${thread.environmentId}:${thread.projectId}`) ?? null}
            machine={machineOf(thread.environmentId)}
            onOpen={openThread}
            onMove={onMove}
          />
        ))}
        {target === "draft"
          ? drafts.map((task) => (
              <CardFrame
                key={task.key}
                project={projectByKey.get(`${task.environmentId}:${task.projectId}`) ?? null}
                machine={machineOf(task.environmentId)}
                title={task.title}
                onOpen={() => openPendingTask(task)}
              />
            ))
          : null}
        {target === "done" && sorted.done.length > DONE_LIMIT ? (
          <View className="flex-row">
            <Button
              label={doneExpanded ? "Show fewer" : `Show ${sorted.done.length - DONE_LIMIT} more`}
              tone="text"
              size="compact"
              onPress={() => setDoneExpanded((value) => !value)}
            />
          </View>
        ) : null}
      </>
    );
  };
  const projectChip =
    projects.length > 1 ? (
      <View className="flex-row">
        <ListFilterMenu
          label={
            scopedProjects.length === 0
              ? "All projects"
              : onlyProject && scopedProjects.length === 1
                ? onlyProject.title
                : `${scopedProjects.length} projects`
          }
          accessibilityLabel="Choose projects"
          leading={
            onlyProject && scopedProjects.length === 1
              ? projectIcon(onlyProject, 16)
              : allProjectsIcon(16)
          }
          active={scopedProjects.length > 0}
          actionIcons={Object.fromEntries(
            projects.map((project) => [projectKey(project), projectIcon(project, 24)] as const),
          )}
          actions={[
            { id: "all", title: "All projects", state: scope.length === 0 ? "on" : "off" },
            ...projects.map((project) => ({
              id: projectKey(project),
              title: project.title,
              state: scope.includes(projectKey(project)) ? ("on" as const) : ("off" as const),
            })),
          ]}
          onSelect={(id) => (id === "all" ? setScope([]) : toggleScope(id))}
        />
      </View>
    ) : null;

  return (
    <SettingsScreen title="Board" workspaceRoot>
      {wide ? (
        <View className="flex-1 gap-3 pt-4">
          <View className="px-4">{projectChip}</View>
          <RowScrollView
            horizontal
            className="flex-1"
            contentContainerClassName="gap-3 px-4 pb-4"
            showsHorizontalScrollIndicator={false}
          >
            {BOARD_COLUMNS.map((target) => {
              const label = `${BOARD_COLUMN_LABELS[target]} ${count(target)}`;
              return collapsed.has(target) ? (
                <Pressable
                  key={target}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand ${label}`}
                  accessibilityState={{ expanded: false }}
                  onPress={() => toggleCollapsed(target)}
                  className="w-10 items-center rounded-2xl bg-grouped-card pt-3 active:opacity-70"
                >
                  <SymbolView
                    name="chevron.right"
                    size={14}
                    tintColorClassName="accent-icon-subtle"
                  />
                  <View style={{ width: 20, height: 150, marginTop: 8 }}>
                    <Text
                      textRole="footnote"
                      numberOfLines={1}
                      className="font-t3-bold"
                      style={{
                        position: "absolute",
                        width: 150,
                        height: 20,
                        left: -65,
                        top: 65,
                        textAlign: "left",
                        transform: [{ rotate: "90deg" }],
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View key={target} className="w-72 rounded-2xl bg-grouped-card">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Collapse ${label}`}
                    accessibilityState={{ expanded: true }}
                    onPress={() => toggleCollapsed(target)}
                    className="flex-row items-center gap-1.5 px-3 pt-2.5 pb-2 active:opacity-70"
                  >
                    <SymbolView
                      name="chevron.down"
                      size={14}
                      tintColorClassName="accent-icon-subtle"
                    />
                    <Text textRole="footnote" className="font-t3-bold">
                      {BOARD_COLUMN_LABELS[target]}{" "}
                      <Text textRole="footnote" className="text-foreground-muted">
                        {count(target)}
                      </Text>
                    </Text>
                  </Pressable>
                  <RowScrollView
                    className="flex-1"
                    contentContainerClassName="px-2 pb-2"
                    showsVerticalScrollIndicator={false}
                  >
                    {columnCards(target)}
                  </RowScrollView>
                </View>
              );
            })}
          </RowScrollView>
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerClassName="gap-3 px-4 pt-4 pb-6"
        >
          {projectChip}
          <RowScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {BOARD_COLUMNS.map((candidate) => (
              <Chip
                key={candidate}
                label={`${BOARD_COLUMN_LABELS[candidate]} ${count(candidate)}`}
                accessibilityLabel={`${BOARD_COLUMN_LABELS[candidate]}, ${count(candidate)} ${count(candidate) === 1 ? "card" : "cards"}`}
                selected={candidate === column}
                onPress={() => setColumn(candidate)}
              />
            ))}
          </RowScrollView>
          <View>{columnCards(column)}</View>
        </ScrollView>
      )}
    </SettingsScreen>
  );
}
