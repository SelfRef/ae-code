import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  branchMergeState,
  branchProjects,
  canMergeBranch,
  filterBranches,
  isDeletableBranch,
  isPlainLocalBranch,
  sortBranches,
  threadForBranch,
  type BranchKind,
  type BranchMergeFilter,
  type BranchSort,
} from "@t3tools/client-runtime/branch-overview";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  ALL_VCS_REMOTES,
  AuthSourceControlWriteScope,
  type EnvironmentId,
  type VcsBranchOverviewEntry,
  type VcsBranchOverviewResult,
} from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownAZIcon,
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  CalendarArrowUpIcon,
  ClockIcon,
  CloudIcon,
  FolderGit2Icon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  LayersIcon,
  MessageSquareIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { requestConfirmDialog } from "~/confirmDialog";
import { usePageProject } from "~/hooks/usePageProject";
import { useProjects, useQuietThreadShells } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { useEnvironmentScope } from "~/state/session";
import { useGitStackedAction } from "~/state/sourceControlActions";
import { useAtomCommand } from "~/state/use-atom-command";
import { vcsEnvironment } from "~/state/vcs";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn, randomUUID } from "~/lib/utils";
import { buildThreadRouteParams } from "../../threadRoutes";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { toastManager } from "../ui/toast";
import { ListFiltersMenu, ListRefreshButton } from "../ListToolbar";
import { ProjectPageHeader } from "../ProjectPageHeader";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { PullRequestCompactFilterMenu } from "../pullRequest/PullRequestCompactFilterMenu";
import {
  PullRequestFilterRadioSubmenu,
  type PullRequestFilterOption,
} from "../pullRequest/PullRequestListFilters";

const SORT_OPTIONS = [
  { value: "recent", label: "Latest commit", Icon: ClockIcon },
  { value: "oldest", label: "Oldest commit", Icon: CalendarArrowUpIcon },
  { value: "ahead", label: "Most unmerged commits", Icon: ArrowUpIcon },
  { value: "name", label: "Name", Icon: ArrowDownAZIcon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<BranchSort>>;

const UNFILTERED = "all";
const MERGE_OPTIONS = [
  { value: UNFILTERED, label: "All", Icon: LayersIcon },
  { value: "unmerged", label: "Not merged", Icon: GitBranchIcon },
  { value: "merged", label: "Merged", Icon: PullRequestGlyph.merged },
] as const satisfies ReadonlyArray<PullRequestFilterOption<string>>;
const KIND_OPTIONS = [
  { value: UNFILTERED, label: "All", Icon: LayersIcon },
  { value: "branch", label: "Branch", Icon: GitBranchIcon },
  { value: "worktree", label: "Worktree", Icon: FolderGit2Icon },
  { value: "remote", label: "Remote only", Icon: CloudIcon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<string>>;

function BranchRow({
  environmentId,
  branch,
  defaultRef,
  threadTitle,
  onOpenThread,
  onOpenCommits,
  onDelete,
  onMerged,
}: {
  environmentId: EnvironmentId;
  branch: VcsBranchOverviewEntry;
  defaultRef: string | null;
  threadTitle: string | null;
  onOpenThread: () => void;
  onOpenCommits: () => void;
  /** Absent when the branch cannot be deleted here. */
  onDelete: (() => void) | undefined;
  onMerged: () => void;
}) {
  const state = branchMergeState(branch);
  const canWrite = useEnvironmentScope(environmentId, AuthSourceControlWriteScope);
  const mergeAction = useGitStackedAction({ environmentId, cwd: branch.worktreePath });
  const target = defaultRef ?? "the default branch";
  const merge = async () => {
    const confirmed = await requestConfirmDialog(
      `Merge ${branch.name} into ${target}?\nUncommitted changes in its worktree are committed first. ${target} is fast-forwarded, and the branch is rebased onto it if it moved. Nothing is pushed.`,
    );
    if (confirmed !== true) return;
    const result = await mergeAction.run({ actionId: randomUUID(), action: "merge" });
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not merge",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    } else {
      toastManager.add({
        type: "success",
        title: result.value.toast.title,
        ...(result.value.toast.description ? { description: result.value.toast.description } : {}),
      });
    }
    onMerged();
  };
  const Icon = branch.worktreePath !== null ? FolderGit2Icon : GitBranchIcon;
  const unpushed = !branch.isRemoteOnly && !branch.isDefault && branch.upstream === null;
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start gap-2.5 border-b border-l-2 px-3 py-2.5",
        state === "unmerged" ? "border-l-warning bg-warning/4" : "border-l-transparent",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate font-mono text-sm font-medium">{branch.name}</span>
          {branch.isDefault ? <Badge variant="info">Default</Badge> : null}
          {branch.current ? <Badge variant="outline">Checked out</Badge> : null}
          <Badge variant="secondary">
            {branch.isRemoteOnly
              ? "Remote only"
              : branch.worktreePath !== null
                ? "Worktree"
                : "Branch"}
          </Badge>
          {state === "unmerged" ? (
            <Badge variant="warning">
              {branch.aheadOfDefault} ahead of {defaultRef ?? "default"}
            </Badge>
          ) : state === "merged" ? (
            <Badge variant="success">Merged</Badge>
          ) : null}
          {state !== "default" && branch.behindDefault > 0 ? (
            <Badge variant="outline">{branch.behindDefault} behind</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {branch.ahead > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <ArrowUpIcon className="size-3" />
              {branch.ahead} to push
            </span>
          ) : null}
          {branch.behind > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <ArrowDownIcon className="size-3" />
              {branch.behind} to pull
            </span>
          ) : null}
          {branch.upstreamGone ? <span>Upstream deleted</span> : null}
          {unpushed ? <span>Not pushed</span> : null}
          {branch.lastCommitAt ? <span>{formatRelativeTimeLabel(branch.lastCommitAt)}</span> : null}
          {branch.lastCommitSubject ? (
            <span className="min-w-0 truncate">{branch.lastCommitSubject}</span>
          ) : null}
        </div>
        {branch.worktreePath ? (
          <span className="truncate font-mono text-xs text-muted-foreground">
            {branch.worktreePath}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="icon-xs"
          variant="outline"
          aria-label={`Commit history of ${branch.name}`}
          title="Commit history"
          onClick={onOpenCommits}
        >
          <GitCommitHorizontalIcon />
        </Button>
        {canWrite && canMergeBranch(branch) ? (
          <Button
            size="icon-xs"
            variant="outline"
            aria-label={`Merge ${branch.name} into ${target}`}
            title={`Merge into ${target}`}
            disabled={mergeAction.isPending}
            onClick={() => void merge()}
          >
            <PullRequestGlyph.merged />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            size="icon-xs"
            variant="outline"
            aria-label={`Delete branch ${branch.name}`}
            title="Delete branch"
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        ) : null}
        {threadTitle !== null ? (
          <Button
            size="compact"
            variant="outline"
            className="max-w-48"
            aria-label={`Open thread ${threadTitle}`}
            title={threadTitle}
            onClick={onOpenThread}
          >
            <MessageSquareIcon />
            <span className="hidden truncate @2xl/branches:inline">{threadTitle}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export interface BranchFilters {
  merge?: BranchMergeFilter | undefined;
  kind?: BranchKind | undefined;
  /** A remote's name, or `all`; absent means the first remote. */
  remote?: string | undefined;
  branchSort?: BranchSort | undefined;
}

export function useBranchOverview(
  project: Pick<EnvironmentProject, "environmentId" | "workspaceRoot"> | null,
  remote: string | undefined,
) {
  return useEnvironmentQuery(
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
}

export function BranchSummary({ data }: { data: VcsBranchOverviewResult | null }) {
  if (!data?.isRepo) return null;
  const unmerged = data.branches.filter((b) => branchMergeState(b) === "unmerged").length;
  return (
    <span className="min-w-0 truncate text-xs text-muted-foreground">
      {unmerged > 0 ? `${unmerged} not merged into ${data.defaultRef}` : "All merged"}
    </span>
  );
}

/** Search, sort and filters over the project's branches, shared by the page and the right-panel tab. */
export function BranchList({
  project,
  overview,
  filters,
  onFilters,
  onOpenCommits,
}: {
  project: Pick<EnvironmentProject, "environmentId" | "id" | "title" | "workspaceRoot"> | null;
  overview: ReturnType<typeof useBranchOverview>;
  filters: BranchFilters;
  onFilters: (patch: BranchFilters) => void;
  /** Opens the commit history of a branch, named as in the branch list. */
  onOpenCommits: (branchName: string) => void;
}) {
  const navigate = useNavigate();
  const threads = useQuietThreadShells();
  const [query, setQuery] = useState("");
  const data = overview.data;
  const deleteMergedBranches = useAtomCommand(vcsEnvironment.deleteMergedBranches, {
    reportFailure: false,
  });
  const canDelete = useEnvironmentScope(
    project?.environmentId ?? null,
    AuthSourceControlWriteScope,
  );
  // Plain local branches the default branch already contains: nothing is lost by deleting them.
  const mergedBranches = (data?.branches ?? []).filter(
    (branch) => isPlainLocalBranch(branch) && branchMergeState(branch) === "merged",
  );
  const deleteBranches = async (names: ReadonlyArray<string>, force: boolean) => {
    if (project === null) return;
    const result = await deleteMergedBranches({
      environmentId: project.environmentId,
      input: { cwd: project.workspaceRoot, refNames: names, ...(force ? { force } : {}) },
    });
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not delete branches",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    } else {
      const { deleted, skipped } = result.value;
      toastManager.add({
        type: skipped.length > 0 ? "warning" : "success",
        title: `Deleted ${deleted.length} ${deleted.length === 1 ? "branch" : "branches"}`,
        ...(skipped.length > 0
          ? {
              description: `Kept ${skipped.map((entry) => `${entry.name} (${entry.reason})`).join("; ")}`,
            }
          : {}),
      });
    }
    overview.refresh();
  };
  const deleteMerged = async () => {
    if (mergedBranches.length === 0) return;
    const names = mergedBranches.map((branch) => branch.name);
    const shown = names.slice(0, 8).join(", ");
    const confirmed = await requestConfirmDialog(
      `Delete ${names.length} merged ${names.length === 1 ? "branch" : "branches"}?\n${shown}${names.length > 8 ? ` and ${names.length - 8} more` : ""} ${names.length === 1 ? "is" : "are"} already in ${data?.defaultRef ?? "the default branch"}. Remote copies stay.`,
      { variant: "destructive" },
    );
    if (confirmed === true) await deleteBranches(names, false);
  };
  const deleteOne = async (branch: VcsBranchOverviewEntry) => {
    const inWorktree = branch.worktreePath !== null;
    const lost = branchMergeState(branch) !== "merged";
    const confirmed = await requestConfirmDialog(
      `Delete ${inWorktree ? "worktree and " : ""}branch ${branch.name}?\n${lost ? `Its ${branch.aheadOfDefault} commits not in ${data?.defaultRef ?? "the default branch"} are lost unless another branch or a remote has them.` : `It is already in ${data?.defaultRef ?? "the default branch"}.`}${inWorktree ? " The worktree folder and its uncommitted changes are deleted." : ""} Remote copies stay.`,
      { variant: "destructive" },
    );
    if (confirmed === true) await deleteBranches([branch.name], lost || inWorktree);
  };
  const remotes = data?.remotes ?? [];
  const remote = data === null ? ALL_VCS_REMOTES : (data.remote ?? ALL_VCS_REMOTES);
  const branches = sortBranches(
    filterBranches(data?.branches ?? [], {
      merge: filters.merge,
      kind: filters.kind,
      query,
    }),
    filters.branchSort ?? "recent",
  );
  const filterCount = [
    filters.merge,
    filters.kind,
    filters.remote !== undefined && filters.remote !== remotes[0],
  ].filter(Boolean).length;
  const remoteOptions: ReadonlyArray<PullRequestFilterOption<string>> = [
    { value: ALL_VCS_REMOTES, label: "All remotes", Icon: LayersIcon },
    ...remotes.map((name) => ({ value: name, label: name, Icon: CloudIcon })),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <InputGroup className="min-w-0 basis-full flex-1 sm:basis-0 **:[input]:h-9 sm:**:[input]:h-8">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search branches"
            aria-label="Search branches"
          />
        </InputGroup>
        <PullRequestCompactFilterMenu
          label="Sort branches"
          triggerIcon={<ArrowDownUpIcon aria-hidden className="size-4" />}
          triggerLabel="Sort"
          outlined
          value={filters.branchSort ?? "recent"}
          options={SORT_OPTIONS}
          onChange={(sort) => onFilters({ branchSort: sort === "recent" ? undefined : sort })}
        />
        <ListFiltersMenu count={filterCount}>
          <PullRequestFilterRadioSubmenu
            label="Merge state"
            value={filters.merge ?? UNFILTERED}
            options={MERGE_OPTIONS}
            onChange={(next) =>
              onFilters({ merge: next === UNFILTERED ? undefined : (next as BranchMergeFilter) })
            }
          />
          <PullRequestFilterRadioSubmenu
            label="Kind"
            value={filters.kind ?? UNFILTERED}
            options={KIND_OPTIONS}
            onChange={(next) =>
              onFilters({ kind: next === UNFILTERED ? undefined : (next as BranchKind) })
            }
          />
          {remotes.length > 1 ? (
            <PullRequestFilterRadioSubmenu
              label="Remote"
              value={remote}
              options={remoteOptions}
              onChange={(next) => onFilters({ remote: next })}
            />
          ) : null}
        </ListFiltersMenu>
        {mergedBranches.length > 0 && canDelete ? (
          <Button
            size="compact"
            variant="outline"
            aria-label={`Delete ${mergedBranches.length} merged branches`}
            onClick={() => void deleteMerged()}
          >
            <Trash2Icon />
            <span>Delete merged ({mergedBranches.length})</span>
          </Button>
        ) : null}
        <ListRefreshButton
          label="Refresh branches"
          refreshing={overview.isPending}
          onRefresh={overview.refresh}
        />
      </div>
      <div className="@container/branches min-h-0 flex-1 overflow-y-auto">
        {project === null ? (
          <Empty size="compact">
            <EmptyHeader>
              <EmptyTitle>No project</EmptyTitle>
              <EmptyDescription>Add a project to see its branches.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : data === null ? (
          overview.error !== null ? (
            <div className="flex flex-col items-start gap-2 p-4 text-sm">
              <span className="text-destructive-foreground">{overview.error}</span>
              <Button size="compact" variant="outline" onClick={overview.refresh}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="flex justify-center p-6">
              <Spinner className="size-4" />
            </div>
          )
        ) : !data.isRepo ? (
          <Empty size="compact">
            <EmptyHeader>
              <EmptyTitle>Not a Git repository</EmptyTitle>
              <EmptyDescription>{project.title} has no branches to list.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {branches.length === 0 ? (
              <Empty size="compact">
                <EmptyHeader>
                  <EmptyTitle>
                    {filters.merge === "unmerged" ? "Everything is merged" : "No matching branches"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {filters.merge === "unmerged"
                      ? `No branch has commits that ${data.defaultRef} lacks.`
                      : "Change the search or the filters to see more."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {branches.map((branch) => {
              const thread = threadForBranch(threads, project, branch);
              return (
                <BranchRow
                  key={`${branch.isRemoteOnly ? "remote" : "local"}:${branch.name}`}
                  environmentId={project.environmentId}
                  branch={branch}
                  defaultRef={data.defaultRef}
                  onMerged={overview.refresh}
                  threadTitle={thread?.title ?? null}
                  onOpenCommits={() => onOpenCommits(branch.name)}
                  onDelete={
                    canDelete && isDeletableBranch(branch)
                      ? () => void deleteOne(branch)
                      : undefined
                  }
                  onOpenThread={() => {
                    if (thread)
                      void navigate({
                        to: "/$environmentId/$threadId",
                        params: buildThreadRouteParams(
                          scopeThreadRef(thread.environmentId, thread.id),
                        ),
                      });
                  }}
                />
              );
            })}
            {data.truncated ? (
              <p className="p-3 text-xs text-muted-foreground">
                Showing the {data.branches.length} most recent branches.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

export function BranchesPage() {
  const search = useSearch({ from: "/_chat/branches" });
  const navigate = useNavigate();
  const projects = branchProjects(useProjects());
  const project = usePageProject(projects, search);
  const overview = useBranchOverview(project, search.remote);

  const update = (patch: { [K in keyof typeof search]?: (typeof search)[K] | undefined }) => {
    const next = Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined);
    void navigate({ to: "/branches", search: Object.fromEntries(next) as typeof search });
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <ProjectPageHeader
        title="Branches"
        project={project}
        projects={projects}
        onProject={(next) =>
          update({ environmentId: next.environmentId, projectId: next.id, remote: undefined })
        }
      >
        <BranchSummary data={overview.data} />
      </ProjectPageHeader>
      <BranchList
        project={project}
        overview={overview}
        filters={search}
        onFilters={update}
        onOpenCommits={(ref) => {
          if (project)
            void navigate({
              to: "/commits",
              search: { environmentId: project.environmentId, projectId: project.id, ref },
            });
        }}
      />
    </SidebarInset>
  );
}
