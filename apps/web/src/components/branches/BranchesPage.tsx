import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  branchMergeState,
  branchProjects,
  threadForBranch,
} from "@t3tools/client-runtime/branch-overview";
import { projectKey, selectIssueProject } from "@t3tools/client-runtime/issue-projects";
import type { VcsBranchOverviewEntry } from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FolderGit2Icon,
  GitBranchIcon,
  MessageSquareIcon,
} from "lucide-react";

import { useProjects, useQuietThreadShells } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { vcsEnvironment } from "~/state/vcs";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn } from "~/lib/utils";
import { buildThreadRouteParams } from "../../threadRoutes";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { RefreshIcon } from "../ui/refresh-icon";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";

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
  const project = selectIssueProject(projects, search);
  const threads = useQuietThreadShells();
  const overview = useEnvironmentQuery(
    project === null
      ? null
      : vcsEnvironment.branchOverview({
          environmentId: project.environmentId,
          input: { cwd: project.workspaceRoot, fetch: true },
        }),
  );

  const update = (patch: { [K in keyof typeof search]?: (typeof search)[K] | undefined }) => {
    const next = Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined);
    void navigate({ to: "/branches", search: Object.fromEntries(next) as typeof search });
  };

  const data = overview.data;
  const unmergedCount =
    data?.branches.filter((b) => branchMergeState(b) === "unmerged").length ?? 0;
  const branches =
    data?.branches.filter((b) => !search.unmerged || branchMergeState(b) === "unmerged") ?? [];

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <header className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">Branches</h1>
          {data?.isRepo ? (
            <span className="text-xs text-muted-foreground">
              {unmergedCount > 0
                ? `${unmergedCount} not merged into ${data.defaultRef}`
                : "All merged"}
            </span>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost-muted"
            aria-label="Refresh"
            className="ms-auto"
            onClick={overview.refresh}
          >
            <RefreshIcon className="size-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && project !== null ? (
            <Select
              value={projectKey(project)}
              onValueChange={(key) => {
                const next = projects.find((candidate) => projectKey(candidate) === key);
                if (next) update({ environmentId: next.environmentId, projectId: next.id });
              }}
            >
              <SelectTrigger size="compact" aria-label="Project" className="w-auto min-w-40">
                <SelectValue>{project.title}</SelectValue>
              </SelectTrigger>
              <SelectPopup alignItemWithTrigger={false}>
                {projects.map((candidate) => (
                  <SelectItem key={projectKey(candidate)} value={projectKey(candidate)}>
                    {candidate.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : null}
          <div className="flex gap-1" role="tablist" aria-label="Filter">
            {[
              { value: undefined, label: "All" },
              { value: true as const, label: "Not merged" },
            ].map((entry) => (
              <Button
                key={entry.label}
                size="compact"
                role="tab"
                aria-selected={search.unmerged === entry.value}
                variant={search.unmerged === entry.value ? "outline" : "ghost-muted"}
                onClick={() => update({ unmerged: entry.value })}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
      </header>
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
                  <EmptyTitle>Everything is merged</EmptyTitle>
                  <EmptyDescription>
                    No branch has commits that {data.defaultRef} lacks.
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
