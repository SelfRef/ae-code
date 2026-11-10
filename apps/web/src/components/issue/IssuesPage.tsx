import type { IssueListSort, IssueListState, IssueSummary } from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownUpIcon,
  ArrowLeftIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  CircleCheckIcon,
  CircleDotIcon,
  ClockIcon,
  LayersIcon,
  MessageSquareIcon,
  PenLineIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { issueEnvironment } from "~/state/issues";
import { useEnvironmentQuery } from "~/state/query";
import { usePageProject } from "~/hooks/usePageProject";
import { useProjects } from "~/state/entities";
import { useSourceControlSignIn } from "~/state/sourceControl";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn } from "~/lib/utils";

import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { ListFiltersMenu, ListRefreshButton } from "../ListToolbar";
import { ProjectPageHeader } from "../ProjectPageHeader";
import { PullRequestCompactFilterMenu } from "../pullRequest/PullRequestCompactFilterMenu";
import {
  PullRequestFilterRadioSubmenu,
  type PullRequestFilterOption,
} from "../pullRequest/PullRequestListFilters";
import { PullRequestLabelChip } from "../pullRequest/pullRequestPresentation";
import { IssueDetailPane } from "./IssueDetailPane";
import { IssueStateGlyph } from "./IssueStateGlyph";
import { issueProjects, projectKey } from "@t3tools/client-runtime/issue-projects";

export const ISSUE_STATES = [
  { value: "open", label: "Open", Icon: CircleDotIcon },
  { value: "closed", label: "Closed", Icon: CircleCheckIcon },
  { value: "all", label: "All", Icon: LayersIcon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<IssueListState>>;

const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated", Icon: ClockIcon },
  { value: "newest", label: "Newest", Icon: CalendarArrowDownIcon },
  { value: "oldest", label: "Oldest", Icon: CalendarArrowUpIcon },
  { value: "comments", label: "Most commented", Icon: MessageSquareIcon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<IssueListSort>>;

const INVOLVEMENT_OPTIONS = [
  { value: "all", label: "Everyone", Icon: LayersIcon },
  { value: "author", label: "Created by me", Icon: PenLineIcon },
  { value: "assignee", label: "Assigned to me", Icon: UserRoundIcon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<string>>;

/** GitHub's own search syntax: `@me` is the signed-in user. */
const INVOLVEMENT_QUALIFIER = { author: "author:@me", assignee: "assignee:@me" } as const;

const issueListQuery = (
  environmentId: Parameters<typeof issueEnvironment.list>[0]["environmentId"],
  input: {
    projectId: Parameters<typeof issueEnvironment.list>[0]["input"]["projectId"];
    state: IssueListState;
    sort?: IssueListSort | undefined;
    query: string | undefined;
    page: number;
  },
) =>
  issueEnvironment.list({
    environmentId,
    input: {
      projectId: input.projectId,
      state: input.state,
      ...(input.sort ? { sort: input.sort } : {}),
      ...(input.query ? { query: input.query } : {}),
      page: input.page,
    },
  });

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

export function IssueListPage({
  environmentId,
  projectId,
  state,
  sort,
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
  sort?: IssueListSort | undefined;
  query: string | undefined;
  page: number;
  selectedNumber: number | undefined;
  isLast: boolean;
  onSelect: (number: number) => void;
  onMore: () => void;
}) {
  const result = useEnvironmentQuery(
    issueListQuery(environmentId, { projectId, state, sort, query, page }),
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
  const projects = issueProjects(useProjects(), useSourceControlSignIn().githubSignedOut);
  const project = usePageProject(projects, search);
  const [pages, setPages] = useState(1);
  const [draft, setDraft] = useState(search.q ?? "");
  const [refreshToken, setRefreshToken] = useState(0);
  const query =
    [search.involves ? INVOLVEMENT_QUALIFIER[search.involves] : "", search.q ?? ""]
      .filter(Boolean)
      .join(" ") || undefined;
  // The first page stays mounted through a refresh, so its spinner can show here.
  const firstPage = useEnvironmentQuery(
    project === null
      ? null
      : issueListQuery(project.environmentId, {
          projectId: project.id,
          state: search.state,
          sort: search.issueSort,
          query,
          page: 1,
        }),
  );

  // An undefined value clears that search param.
  const update = (
    patch: { [K in keyof typeof search]?: (typeof search)[K] | undefined },
    resetPages = true,
  ) => {
    if (resetPages) setPages(1);
    const next = Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined);
    void navigate({ to: "/issues", search: Object.fromEntries(next) as typeof search });
  };
  const submitQuery = (event: FormEvent) => {
    event.preventDefault();
    update({ q: draft.trim() || undefined, number: undefined });
  };

  const selectedNumber = search.number;
  const detail =
    project !== null && selectedNumber !== undefined ? { project, number: selectedNumber } : null;
  const detailOpen = detail !== null;
  const filterCount = [search.state !== "open", search.involves].filter(Boolean).length;
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 flex-1">
        <section
          className={cn(
            "flex min-h-0 w-full flex-col border-r md:w-[26rem] md:shrink-0",
            detailOpen && "hidden md:flex",
          )}
        >
          <ProjectPageHeader
            title="Issues"
            project={project}
            projects={projects}
            reserveNativeControls={false}
            onProject={(next) =>
              update({ environmentId: next.environmentId, projectId: next.id, number: undefined })
            }
          />
          <div className="flex flex-col gap-2 border-b p-3">
            <form onSubmit={submitQuery}>
              <InputGroup className="**:[input]:h-9 sm:**:[input]:h-8">
                <InputGroupAddon>
                  <SearchIcon aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  placeholder="Search issues"
                  aria-label="Search issues"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </InputGroup>
            </form>
            <div className="flex items-center gap-2">
              <PullRequestCompactFilterMenu
                label="Sort issues"
                triggerIcon={<ArrowDownUpIcon aria-hidden className="size-4" />}
                triggerLabel="Sort"
                outlined
                value={search.issueSort ?? "updated"}
                options={SORT_OPTIONS}
                onChange={(sort) =>
                  update({ issueSort: sort === "updated" ? undefined : sort, number: undefined })
                }
              />
              <ListFiltersMenu count={filterCount}>
                <PullRequestFilterRadioSubmenu
                  label="State"
                  value={search.state}
                  options={ISSUE_STATES}
                  onChange={(state) => update({ state, number: undefined })}
                />
                <PullRequestFilterRadioSubmenu
                  label="Involvement"
                  value={search.involves ?? "all"}
                  options={INVOLVEMENT_OPTIONS}
                  onChange={(next) =>
                    update({
                      involves: next === "all" ? undefined : (next as "author" | "assignee"),
                      number: undefined,
                    })
                  }
                />
              </ListFiltersMenu>
              <ListRefreshButton
                label="Refresh issues"
                refreshing={firstPage.isPending}
                onRefresh={() => {
                  setPages(1);
                  setRefreshToken((token) => token + 1);
                  firstPage.refresh();
                }}
              />
            </div>
          </div>
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
                  key={`${projectKey(project)}:${search.state}:${search.issueSort ?? ""}:${query ?? ""}:${index === 0 ? "" : refreshToken}:${index + 1}`}
                  environmentId={project.environmentId}
                  projectId={project.id}
                  state={search.state}
                  sort={search.issueSort}
                  query={query}
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
