import type { IssueListState, IssueSummary } from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { issueEnvironment } from "~/state/issues";
import { useEnvironmentQuery } from "~/state/query";
import { useProjects } from "~/state/entities";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn } from "~/lib/utils";

import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { Input } from "../ui/input";
import { RefreshIcon } from "../ui/refresh-icon";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { PullRequestLabelChip } from "../pullRequest/pullRequestPresentation";
import { IssueDetailPane } from "./IssueDetailPane";
import { IssueStateGlyph } from "./IssueStateGlyph";
import {
  issueProjects,
  projectKey,
  selectIssueProject,
} from "@t3tools/client-runtime/issue-projects";

const STATES: ReadonlyArray<{ readonly value: IssueListState; readonly label: string }> = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

function IssueRow({
  issue,
  selected,
  onSelect,
}: {
  issue: IssueSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full min-w-0 items-start gap-2.5 border-b px-3 py-2.5 text-left hover:bg-accent/50",
        selected && "bg-accent",
      )}
    >
      <IssueStateGlyph issue={issue} className="mt-0.5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{issue.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>#{issue.number}</span>
          {issue.author ? <span>{issue.author.login}</span> : null}
          <span>{formatRelativeTimeLabel(issue.updatedAt)}</span>
          {issue.commentCount > 0 ? <span>{issue.commentCount} comments</span> : null}
        </span>
        {issue.labels.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <PullRequestLabelChip key={label.name} label={label} />
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function IssueListPage({
  environmentId,
  projectId,
  state,
  query,
  page,
  selectedNumber,
  isLast,
  onSelect,
  onMore,
}: {
  environmentId: Parameters<typeof issueEnvironment.list>[0]["environmentId"];
  projectId: Parameters<typeof issueEnvironment.list>[0]["input"]["projectId"];
  state: IssueListState;
  query: string | undefined;
  page: number;
  selectedNumber: number | undefined;
  isLast: boolean;
  onSelect: (number: number) => void;
  onMore: () => void;
}) {
  const result = useEnvironmentQuery(
    issueEnvironment.list({
      environmentId,
      input: { projectId, state, ...(query ? { query } : {}), page },
    }),
  );
  if (result.data === null) {
    return result.error !== null ? (
      <div className="flex flex-col items-start gap-2 p-4 text-sm">
        <span className="text-destructive-foreground">{result.error}</span>
        <Button size="compact" variant="outline" onClick={result.refresh}>
          Try again
        </Button>
      </div>
    ) : (
      <div className="flex justify-center p-6">
        <Spinner className="size-4" />
      </div>
    );
  }
  return (
    <>
      {page === 1 && result.data.issues.length === 0 ? (
        <Empty size="compact">
          <EmptyHeader>
            <EmptyTitle>No issues</EmptyTitle>
            <EmptyDescription>
              {query ? "Nothing matches this search." : `${result.data.repository} has none here.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {result.data.issues.map((issue) => (
        <IssueRow
          key={issue.number}
          issue={issue}
          selected={issue.number === selectedNumber}
          onSelect={() => onSelect(issue.number)}
        />
      ))}
      {isLast && result.data.hasMore ? (
        <div className="p-3">
          <Button size="compact" variant="outline" className="w-full" onClick={onMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function IssuesPage() {
  const search = useSearch({ from: "/_chat/issues" });
  const navigate = useNavigate();
  const projects = issueProjects(useProjects());
  const project = selectIssueProject(projects, search);
  const [pages, setPages] = useState(1);
  const [draft, setDraft] = useState(search.q ?? "");
  const [refreshToken, setRefreshToken] = useState(0);

  const update = (patch: Partial<typeof search>, resetPages = true) => {
    if (resetPages) setPages(1);
    void navigate({ to: "/issues", search: { ...search, ...patch } });
  };
  const submitQuery = (event: FormEvent) => {
    event.preventDefault();
    update({ q: draft.trim() || undefined, number: undefined });
  };

  const selectedNumber = search.number;
  const detail =
    project !== null && selectedNumber !== undefined ? { project, number: selectedNumber } : null;
  const detailOpen = detail !== null;
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 flex-1">
        <section
          className={cn(
            "flex min-h-0 w-full flex-col border-r md:w-[26rem] md:shrink-0",
            detailOpen && "hidden md:flex",
          )}
        >
          <header className="flex flex-col gap-2 border-b p-3">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">Issues</h1>
              <Button
                size="icon-sm"
                variant="ghost-muted"
                aria-label="Refresh"
                className="ms-auto"
                onClick={() => {
                  setPages(1);
                  setRefreshToken((token) => token + 1);
                }}
              >
                <RefreshIcon className="size-3.5" />
              </Button>
            </div>
            {projects.length > 1 && project !== null ? (
              <Select
                value={projectKey(project)}
                onValueChange={(key) => {
                  const next = projects.find((candidate) => projectKey(candidate) === key);
                  if (next)
                    update({
                      environmentId: next.environmentId,
                      projectId: next.id,
                      number: undefined,
                    });
                }}
              >
                <SelectTrigger size="compact" aria-label="Project">
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
            <form onSubmit={submitQuery}>
              <Input
                size="compact"
                placeholder="Search issues"
                aria-label="Search issues"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </form>
            <div className="flex gap-1" role="tablist" aria-label="State">
              {STATES.map((entry) => (
                <Button
                  key={entry.value}
                  size="compact"
                  role="tab"
                  aria-selected={search.state === entry.value}
                  variant={search.state === entry.value ? "outline" : "ghost-muted"}
                  onClick={() => update({ state: entry.value, number: undefined })}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {project === null ? (
              <Empty size="compact">
                <EmptyHeader>
                  <EmptyTitle>No GitHub project</EmptyTitle>
                  <EmptyDescription>
                    Issues are listed for projects whose repository is on GitHub.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              Array.from({ length: pages }, (_, index) => (
                <IssueListPage
                  key={`${projectKey(project)}:${search.state}:${search.q ?? ""}:${refreshToken}:${index + 1}`}
                  environmentId={project.environmentId}
                  projectId={project.id}
                  state={search.state}
                  query={search.q}
                  page={index + 1}
                  selectedNumber={search.number}
                  isLast={index + 1 === pages}
                  onSelect={(number) => update({ number }, false)}
                  onMore={() => setPages((current) => current + 1)}
                />
              ))
            )}
          </div>
        </section>
        <section className={cn("min-h-0 min-w-0 flex-1", !detailOpen && "hidden md:block")}>
          {detail !== null ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b p-2 md:hidden">
                <Button
                  size="compact"
                  variant="ghost-muted"
                  onClick={() => update({ number: undefined }, false)}
                >
                  <ArrowLeftIcon /> Issues
                </Button>
              </div>
              <IssueDetailPane
                key={`${projectKey(detail.project)}:${detail.number}:${refreshToken}`}
                environmentId={detail.project.environmentId}
                projectId={detail.project.id}
                workspaceRoot={detail.project.workspaceRoot}
                number={detail.number}
              />
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Select an issue</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </SidebarInset>
  );
}
