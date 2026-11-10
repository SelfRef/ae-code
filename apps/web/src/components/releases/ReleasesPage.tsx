import type { ReleaseSummary } from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeftIcon, TagIcon } from "lucide-react";
import { useState } from "react";

import { issueEnvironment } from "~/state/issues";
import { useEnvironmentQuery } from "~/state/query";
import { useProjects } from "~/state/entities";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn } from "~/lib/utils";

import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { RefreshIcon } from "../ui/refresh-icon";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { Badge } from "../ui/badge";
import { ReleaseBadges, ReleaseDetailPane } from "./ReleaseDetailPane";
import {
  issueProjects,
  projectKey,
  selectIssueProject,
} from "@t3tools/client-runtime/issue-projects";

function ReleaseRow({
  release,
  latest,
  selected,
  onSelect,
}: {
  release: ReleaseSummary;
  latest: boolean;
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
      <TagIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">
          {release.name || release.tagName}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{release.tagName}</span>
          {release.author ? <span>{release.author.login}</span> : null}
          <span>{formatRelativeTimeLabel(release.publishedAt ?? release.createdAt)}</span>
        </span>
        {latest || release.draft || release.prerelease ? (
          <span className="flex flex-wrap gap-1">
            {latest ? <Badge variant="success">Latest</Badge> : null}
            <ReleaseBadges release={release} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function ReleaseListPage({
  environmentId,
  projectId,
  page,
  selectedId,
  isLast,
  onSelect,
  onMore,
}: {
  environmentId: Parameters<typeof issueEnvironment.releaseList>[0]["environmentId"];
  projectId: Parameters<typeof issueEnvironment.releaseList>[0]["input"]["projectId"];
  page: number;
  selectedId: number | undefined;
  isLast: boolean;
  onSelect: (id: number) => void;
  onMore: () => void;
}) {
  const result = useEnvironmentQuery(
    issueEnvironment.releaseList({ environmentId, input: { projectId, page } }),
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
  // GitHub marks "Latest" on the newest published release that is neither a draft nor a pre-release.
  const latestId =
    page === 1
      ? result.data.releases.find((release) => !release.draft && !release.prerelease)?.id
      : undefined;
  return (
    <>
      {page === 1 && result.data.releases.length === 0 ? (
        <Empty size="compact">
          <EmptyHeader>
            <EmptyTitle>No releases</EmptyTitle>
            <EmptyDescription>{result.data.repository} has none yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {result.data.releases.map((release) => (
        <ReleaseRow
          key={release.id}
          release={release}
          latest={release.id === latestId}
          selected={release.id === selectedId}
          onSelect={() => onSelect(release.id)}
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

export function ReleasesPage() {
  const search = useSearch({ from: "/_chat/releases" });
  const navigate = useNavigate();
  const projects = issueProjects(useProjects());
  const project = selectIssueProject(projects, search);
  const [pages, setPages] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);

  // An undefined value clears that search param.
  const update = (
    patch: { [K in keyof typeof search]?: (typeof search)[K] | undefined },
    resetPages = true,
  ) => {
    if (resetPages) setPages(1);
    const next = Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined);
    void navigate({ to: "/releases", search: Object.fromEntries(next) as typeof search });
  };

  const detail = project !== null && search.id !== undefined ? { project, id: search.id } : null;
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
              <h1 className="text-sm font-semibold">Releases</h1>
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
                      id: undefined,
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
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {project === null ? (
              <Empty size="compact">
                <EmptyHeader>
                  <EmptyTitle>No GitHub project</EmptyTitle>
                  <EmptyDescription>
                    Releases are listed for projects whose repository is on GitHub.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              Array.from({ length: pages }, (_, index) => (
                <ReleaseListPage
                  key={`${projectKey(project)}:${refreshToken}:${index + 1}`}
                  environmentId={project.environmentId}
                  projectId={project.id}
                  page={index + 1}
                  selectedId={search.id}
                  isLast={index + 1 === pages}
                  onSelect={(id) => update({ id }, false)}
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
                  onClick={() => update({ id: undefined }, false)}
                >
                  <ArrowLeftIcon /> Releases
                </Button>
              </div>
              <ReleaseDetailPane
                key={`${projectKey(detail.project)}:${detail.id}:${refreshToken}`}
                environmentId={detail.project.environmentId}
                projectId={detail.project.id}
                workspaceRoot={detail.project.workspaceRoot}
                id={detail.id}
              />
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Select a release</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </SidebarInset>
  );
}
