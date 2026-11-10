import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  branchMergeState,
  branchProjects,
  filterBranches,
  sortBranches,
  threadForBranch,
  type BranchKind,
  type BranchMergeFilter,
  type BranchSort,
} from "@t3tools/client-runtime/branch-overview";
import { ALL_VCS_REMOTES, type VcsBranchOverviewEntry } from "@t3tools/contracts";
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
  LayersIcon,
  MessageSquareIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";

import { usePageProject } from "~/hooks/usePageProject";
import { useProjects, useQuietThreadShells } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { vcsEnvironment } from "~/state/vcs";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn } from "~/lib/utils";
import { buildThreadRouteParams } from "../../threadRoutes";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
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
  branch,
  defaultRef,
  threadTitle,
  onOpenThread,
}: {
  branch: VcsBranchOverviewEntry;
  defaultRef: string | null;
  threadTitle: string | null;
  onOpenThread: () => void;
}) {
  const state = branchMergeState(branch);
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
      {threadTitle !== null ? (
        <Button
          size="compact"
          variant="outline"
          className="max-w-48 shrink-0"
          aria-label={`Open thread ${threadTitle}`}
          onClick={onOpenThread}
        >
          <MessageSquareIcon />
          <span className="truncate">{threadTitle}</span>
        </Button>
      ) : null}
    </div>
  );
}

export function BranchesPage() {
  const search = useSearch({ from: "/_chat/branches" });
  const navigate = useNavigate();
  const projects = branchProjects(useProjects());
  const project = usePageProject(projects, search);
  const threads = useQuietThreadShells();
  const [query, setQuery] = useState("");
  const overview = useEnvironmentQuery(
    project === null
      ? null
      : vcsEnvironment.branchOverview({
          environmentId: project.environmentId,
          input: {
            cwd: project.workspaceRoot,
            fetch: true,
            ...(search.remote === undefined ? {} : { remote: search.remote }),
          },
        }),
  );

  const update = (patch: { [K in keyof typeof search]?: (typeof search)[K] | undefined }) => {
    const next = Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined);
    void navigate({ to: "/branches", search: Object.fromEntries(next) as typeof search });
  };

  const data = overview.data;
  const remotes = data?.remotes ?? [];
  const remote = data === null ? ALL_VCS_REMOTES : (data.remote ?? ALL_VCS_REMOTES);
  const unmergedCount =
    data?.branches.filter((b) => branchMergeState(b) === "unmerged").length ?? 0;
  const branches = sortBranches(
    filterBranches(data?.branches ?? [], {
      merge: search.merge,
      kind: search.kind,
      query,
    }),
    search.branchSort ?? "recent",
  );
  const filterCount = [
    search.merge,
    search.kind,
    search.remote !== undefined && search.remote !== remotes[0],
  ].filter(Boolean).length;
  const remoteOptions: ReadonlyArray<PullRequestFilterOption<string>> = [
    { value: ALL_VCS_REMOTES, label: "All remotes", Icon: LayersIcon },
    ...remotes.map((name) => ({ value: name, label: name, Icon: CloudIcon })),
  ];

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
        {data?.isRepo ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {unmergedCount > 0
              ? `${unmergedCount} not merged into ${data.defaultRef}`
              : "All merged"}
          </span>
        ) : null}
      </ProjectPageHeader>
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
          value={search.branchSort ?? "recent"}
          options={SORT_OPTIONS}
          onChange={(sort) => update({ branchSort: sort === "recent" ? undefined : sort })}
        />
        <ListFiltersMenu count={filterCount}>
          <PullRequestFilterRadioSubmenu
            label="Merge state"
            value={search.merge ?? UNFILTERED}
            options={MERGE_OPTIONS}
            onChange={(next) =>
              update({ merge: next === UNFILTERED ? undefined : (next as BranchMergeFilter) })
            }
          />
          <PullRequestFilterRadioSubmenu
            label="Kind"
            value={search.kind ?? UNFILTERED}
            options={KIND_OPTIONS}
            onChange={(next) =>
              update({ kind: next === UNFILTERED ? undefined : (next as BranchKind) })
            }
          />
          {remotes.length > 1 ? (
            <PullRequestFilterRadioSubmenu
              label="Remote"
              value={remote}
              options={remoteOptions}
              onChange={(next) => update({ remote: next })}
            />
          ) : null}
        </ListFiltersMenu>
        <ListRefreshButton
          label="Refresh branches"
          refreshing={overview.isPending}
          onRefresh={overview.refresh}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
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
                    {search.merge === "unmerged" ? "Everything is merged" : "No matching branches"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {search.merge === "unmerged"
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
                  branch={branch}
                  defaultRef={data.defaultRef}
                  threadTitle={thread?.title ?? null}
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
    </SidebarInset>
  );
}
