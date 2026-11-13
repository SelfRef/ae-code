import {
  branchMergeState,
  branchProjects,
  filterBranches,
  isPlainLocalBranch,
  sortBranches,
  threadForBranch,
  type BranchKind,
  type BranchMergeFilter,
  type BranchSort,
} from "@t3tools/client-runtime/branch-overview";
import { projectKey } from "@t3tools/client-runtime/issue-projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useAtomValue } from "@effect/atom-react";
import { ALL_VCS_REMOTES, type VcsBranchOverviewEntry } from "@t3tools/contracts";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { useRef, useState } from "react";
import { Pressable, ScrollView as RowScrollView, View, useWindowDimensions } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Menu } from "../../components/ui/Menu";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import * as Dialog from "../../components/ui/Dialog";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { SearchField } from "../../components/ui/SearchField";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/time";
import { useProjects, useThreadShells } from "../../state/entities";
import { usePageProject } from "../../state/page-project";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { vcsEnvironment } from "../../state/vcs";
import { useOpenWorkspaceDetail } from "../layout/useOpenWorkspaceDetail";
import { ChoiceChip } from "../layout/workspace/ChoiceChip";
import { SettingsScreen } from "../settings/components/SettingsScreen";
import { CommitsView } from "./CommitsView";
import { useMergeBranch } from "./useMergeBranch";

const SORT_OPTIONS = [
  { value: "recent", label: "Latest commit" },
  { value: "oldest", label: "Oldest commit" },
  { value: "ahead", label: "Most unmerged commits" },
  { value: "name", label: "Name" },
] as const satisfies readonly { value: BranchSort; label: string }[];

const UNFILTERED = "all";
const MERGE_OPTIONS = [
  { value: UNFILTERED, label: "Any merge state" },
  { value: "unmerged", label: "Not merged" },
  { value: "merged", label: "Merged" },
] as const;
const KIND_OPTIONS = [
  { value: UNFILTERED, label: "Any kind" },
  { value: "branch", label: "Branch" },
  { value: "worktree", label: "Worktree" },
  { value: "remote", label: "Remote only" },
] as const;

/** Below this window width the row's actions collapse into a menu. */
const COMPACT_WIDTH = 600;

function BranchRow(props: {
  readonly project: Pick<EnvironmentProject, "environmentId" | "id">;
  readonly branch: VcsBranchOverviewEntry;
  readonly defaultRef: string | null;
  readonly threadTitle: string | null;
  readonly onOpenThread: () => void;
  readonly onOpenCommits: () => void;
  /** Absent when the branch cannot be deleted here. */
  readonly onDelete: (() => void) | undefined;
  readonly onMerged: () => void;
}) {
  const { branch } = props;
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  const onMerge = useMergeBranch(props.project, branch, props.defaultRef, props.onMerged);
  const handlers: Record<string, (() => void) | undefined> = {
    commits: props.onOpenCommits,
    merge: onMerge,
    delete: props.onDelete,
  };
  const menuActions = [
    { id: "commits", title: "Commit history", image: "git.commit" },
    ...(onMerge ? [{ id: "merge", title: "Merge", image: "arrow.triangle.merge" }] : []),
    ...(props.onDelete
      ? [{ id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } }]
      : []),
  ];
  const menuProps = {
    title: branch.name,
    actions: menuActions,
    onPressAction: ({ nativeEvent }: { nativeEvent: { event: string } }) =>
      handlers[nativeEvent.event]?.(),
  };
  const state = branchMergeState(branch);
  const kind = branch.isRemoteOnly ? "Remote only" : branch.worktreePath ? "Worktree" : "Branch";
  const sync = [
    branch.ahead > 0 ? `↑${branch.ahead} to push` : null,
    branch.behind > 0 ? `↓${branch.behind} to pull` : null,
    branch.upstreamGone ? "Upstream deleted" : null,
    !branch.isRemoteOnly && !branch.isDefault && branch.upstream === null ? "Not pushed" : null,
  ].filter(Boolean);
  const body = (
    <View className="min-w-0 flex-1 gap-1">
      <Text textRole="body" className="font-t3-bold" numberOfLines={2}>
        {branch.name}
      </Text>
      <Text textRole="footnote" className="text-foreground-muted">
        {[
          branch.isDefault ? "Default" : null,
          kind,
          branch.current ? "Checked out" : null,
          state === "unmerged"
            ? `${branch.aheadOfDefault} ahead of ${props.defaultRef ?? "default"}`
            : state === "merged"
              ? "Merged"
              : null,
          state !== "default" && branch.behindDefault > 0 ? `${branch.behindDefault} behind` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {sync.length > 0 ? (
        <Text textRole="footnote" className="text-foreground-muted">
          {sync.join(" · ")}
        </Text>
      ) : null}
      {branch.lastCommitAt ? (
        <Text textRole="footnote" className="text-foreground-muted" numberOfLines={1}>
          {relativeTime(branch.lastCommitAt)}
          {branch.lastCommitSubject ? ` · ${branch.lastCommitSubject}` : ""}
        </Text>
      ) : null}
      {props.threadTitle !== null ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onOpenThread}
          className="min-w-0 self-start pt-1 active:opacity-70"
        >
          <Text textRole="footnote" className="font-t3-bold text-primary" numberOfLines={1}>
            Open thread: {props.threadTitle}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
  const rowClassName = cn(
    "flex-row items-start gap-1 border-b border-l-2 border-border py-3 pl-3",
    state === "unmerged" ? "border-l-warning-foreground bg-warning" : "border-l-transparent",
  );
  return compact ? (
    // A long press anywhere on the row opens the same menu as the button.
    <Menu shouldOpenOnLongPress {...menuProps}>
      <Pressable className={rowClassName}>
        {body}
        <Menu {...menuProps}>
          <IconButton accessibilityLabel={`Actions for ${branch.name}`} icon="ellipsis" />
        </Menu>
      </Pressable>
    </Menu>
  ) : (
    <View className={rowClassName}>
      {body}
      <View className="flex-row items-center">
        <IconButton
          accessibilityLabel={`Commit history of ${branch.name}`}
          icon="git.commit"
          onPress={props.onOpenCommits}
        />
        {onMerge ? (
          <IconButton
            accessibilityLabel={`Merge ${branch.name} into ${props.defaultRef ?? "the default branch"}`}
            icon="arrow.triangle.merge"
            onPress={onMerge}
          />
        ) : null}
        {props.onDelete ? (
          <IconButton
            accessibilityLabel={`Delete branch ${branch.name}`}
            icon="trash"
            variant="standard"
            tintColorClassName="accent-danger-foreground"
            onPress={props.onDelete}
          />
        ) : null}
      </View>
    </View>
  );
}

/** The Branches tab: every branch and worktree of a project, with what is not merged highlighted. */
export function BranchesScreen() {
  const projects = branchProjects(useProjects());
  const threads = useThreadShells();
  const openDetail = useOpenWorkspaceDetail();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<BranchSort>("recent");
  const [merge, setMerge] = useState<BranchMergeFilter | typeof UNFILTERED>(UNFILTERED);
  const [kind, setKind] = useState<BranchKind | typeof UNFILTERED>(UNFILTERED);
  const [remote, setRemote] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [commitsRef, setCommitsRef] = useState<string | null>(null);
  const searchRef = useRef(null);
  const project = usePageProject(projects, selectedKey);
  const overview = useEnvironmentQuery(
    project === null
      ? null
      : vcsEnvironment.branchOverview({
          environmentId: project.environmentId,
          input: {
            cwd: project.workspaceRoot,
            fetch: true,
            ...(remote === undefined ? {} : { remote }),
          },
        }),
  );
  const data = overview.data;
  const deleteMergedBranches = useAtomCommand(vcsEnvironment.deleteMergedBranches, {
    reportFailure: false,
  });
  const canDelete = useAtomValue(
    vcsEnvironment.deleteMergedBranches.permissionAtom(project?.environmentId ?? null),
  );
  // Plain local branches the default branch already contains: nothing is lost by deleting them.
  const mergedBranches = (data?.branches ?? []).filter(
    (branch) => isPlainLocalBranch(branch) && branchMergeState(branch) === "merged",
  );
  const confirmDelete = (title: string, message: string, names: string[], force: boolean) => {
    if (project === null) return;
    Dialog.confirm({
      title,
      message,
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        void (async () => {
          const result = await deleteMergedBranches({
            environmentId: project.environmentId,
            input: { cwd: project.workspaceRoot, refNames: names, ...(force ? { force } : {}) },
          });
          if (result._tag === "Failure") {
            if (isAtomCommandInterrupted(result)) return;
            const cause = squashAtomCommandFailure(result);
            Dialog.alert(
              "Could not delete branches",
              cause instanceof Error ? cause.message : "Try again.",
            );
          } else if (result.value.skipped.length > 0) {
            Dialog.alert(
              `Deleted ${result.value.deleted.length}`,
              `Kept ${result.value.skipped.map((entry) => `${entry.name} (${entry.reason})`).join("; ")}`,
            );
          }
          overview.refresh();
        })();
      },
    });
  };
  const defaultName = data?.defaultRef ?? "the default branch";
  const deleteMerged = () => {
    if (mergedBranches.length === 0) return;
    const names = mergedBranches.map((branch) => branch.name);
    confirmDelete(
      `Delete ${names.length} merged ${names.length === 1 ? "branch" : "branches"}?`,
      `${names.slice(0, 8).join(", ")}${names.length > 8 ? ` and ${names.length - 8} more` : ""} already in ${defaultName}. Remote copies stay.`,
      names,
      false,
    );
  };
  const deleteOne = (branch: VcsBranchOverviewEntry) => {
    const lost = branchMergeState(branch) !== "merged";
    confirmDelete(
      `Delete branch ${branch.name}?`,
      `${lost ? `Its ${branch.aheadOfDefault} commits not in ${defaultName} are lost unless another branch or a remote has them.` : `It is already in ${defaultName}.`} Remote copies stay.`,
      [branch.name],
      lost,
    );
  };
  const unmerged = data?.branches.filter((branch) => branchMergeState(branch) === "unmerged") ?? [];
  const branches = sortBranches(
    filterBranches(data?.branches ?? [], {
      merge: merge === UNFILTERED ? undefined : merge,
      kind: kind === UNFILTERED ? undefined : kind,
      query,
    }),
    sort,
  );
  const remotes = data?.remotes ?? [];
  const shownRemote = data?.remote ?? ALL_VCS_REMOTES;

  if (commitsRef !== null && project !== null) {
    return (
      <CommitsView
        project={project}
        branches={(data?.branches ?? []).map((branch) => branch.name)}
        initialRef={commitsRef}
        onBack={() => setCommitsRef(null)}
      />
    );
  }

  return (
    <SettingsScreen
      title={project?.title ?? "Branches"}
      workspaceRoot
      refresh={{ accessibilityLabel: "Refresh branches", onPress: overview.refresh }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6"
      >
        {project === null ? (
          <EmptyState
            variant="plain"
            title="No project"
            detail="Add a project to see its branches."
          />
        ) : (
          <View className="gap-3">
            <View className="flex-row">
              <SearchField
                inputRef={searchRef}
                autoFocus={false}
                accessibilityLabel="Search branches"
                clearAccessibilityLabel="Clear search"
                placeholder="Search branches"
                value={query}
                onChangeText={setQuery}
              />
            </View>
            <RowScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {projects.length > 1 ? (
                <ChoiceChip
                  label={project.title}
                  accessibilityLabel="Choose project"
                  options={projects.map((candidate) => ({
                    value: projectKey(candidate),
                    label: candidate.title,
                  }))}
                  selected={projectKey(project)}
                  onSelect={(key) => {
                    setSelectedKey(key);
                    setRemote(undefined);
                  }}
                />
              ) : null}
              <ChoiceChip
                label={SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort"}
                accessibilityLabel="Sort branches"
                options={SORT_OPTIONS}
                selected={sort}
                active={sort !== "recent"}
                onSelect={setSort}
              />
              <ChoiceChip
                label={MERGE_OPTIONS.find((option) => option.value === merge)?.label ?? ""}
                accessibilityLabel="Filter by merge state"
                options={MERGE_OPTIONS}
                selected={merge}
                active={merge !== UNFILTERED}
                onSelect={setMerge}
              />
              <ChoiceChip
                label={KIND_OPTIONS.find((option) => option.value === kind)?.label ?? ""}
                accessibilityLabel="Filter by kind"
                options={KIND_OPTIONS}
                selected={kind}
                active={kind !== UNFILTERED}
                onSelect={setKind}
              />
              {remotes.length > 1 ? (
                <ChoiceChip
                  label={shownRemote === ALL_VCS_REMOTES ? "All remotes" : shownRemote}
                  accessibilityLabel="Filter by remote"
                  options={[
                    ...remotes.map((name) => ({ value: name, label: name })),
                    { value: ALL_VCS_REMOTES, label: "All remotes" },
                  ]}
                  selected={shownRemote}
                  active={shownRemote !== remotes[0]}
                  onSelect={setRemote}
                />
              ) : null}
            </RowScrollView>
            {data === null ? (
              overview.error !== null ? (
                <View className="items-start gap-2 py-4">
                  <Text className="text-destructive">{overview.error}</Text>
                  <Button label="Try again" onPress={overview.refresh} />
                </View>
              ) : (
                <View className="items-center py-6">
                  <AppActivityIndicator size="small" />
                </View>
              )
            ) : !data.isRepo ? (
              <EmptyState
                variant="plain"
                title="Not a Git repository"
                detail={`${project.title} has no branches to list.`}
              />
            ) : (
              <View>
                <Text textRole="footnote" className="pb-2 text-foreground-muted">
                  {unmerged.length > 0
                    ? `${unmerged.length} not merged into ${data.defaultRef}`
                    : "All merged"}
                </Text>
                {mergedBranches.length > 0 && canDelete ? (
                  <View className="flex-row pb-2">
                    <Button
                      label={`Delete merged (${mergedBranches.length})`}
                      onPress={deleteMerged}
                    />
                  </View>
                ) : null}
                {branches.length === 0 ? (
                  <EmptyState
                    variant="plain"
                    title={merge === "unmerged" ? "Everything is merged" : "No matching branches"}
                    detail={
                      merge === "unmerged"
                        ? `No branch has commits that ${data.defaultRef} lacks.`
                        : "Change the search or the filters to see more."
                    }
                  />
                ) : null}
                {branches.map((branch) => {
                  const thread = threadForBranch(threads, project, branch);
                  return (
                    <BranchRow
                      key={`${branch.isRemoteOnly ? "remote" : "local"}:${branch.name}`}
                      project={project}
                      branch={branch}
                      defaultRef={data.defaultRef}
                      onMerged={overview.refresh}
                      threadTitle={thread?.title ?? null}
                      onOpenCommits={() => setCommitsRef(branch.name)}
                      onDelete={
                        canDelete && isPlainLocalBranch(branch)
                          ? () => deleteOne(branch)
                          : undefined
                      }
                      onOpenThread={() => {
                        if (thread)
                          openDetail({
                            name: "Thread",
                            params: {
                              environmentId: String(thread.environmentId),
                              threadId: String(thread.id),
                            },
                          });
                      }}
                    />
                  );
                })}
                {data.truncated ? (
                  <Text textRole="footnote" className="pt-3 text-foreground-muted">
                    Showing the {data.branches.length} most recent branches.
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SettingsScreen>
  );
}
