import {
  commitRefLabel,
  layoutCommitGraph,
  nextCommitLogLimit,
} from "@t3tools/client-runtime/commit-graph";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  ALL_VCS_REFS,
  VCS_COMMIT_LOG_MAX_LIMIT,
  VCS_COMMIT_LOG_PAGE_SIZE,
  type VcsCommitLogEntry,
  type VcsCommitLogResult,
} from "@t3tools/contracts";
import { CheckIcon, CopyIcon, GitGraphIcon, ListIcon, TagIcon } from "lucide-react";
import { useState } from "react";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { vcsEnvironment } from "~/state/vcs";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import type { CommitsView } from "~/commitsTabStore";

import { ListRefreshButton } from "../ListToolbar";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { MiddleTruncate } from "../ui/middle-truncate";
import { Spinner } from "../ui/spinner";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { COMMIT_ROW_HEIGHT, CommitGraphGutter, commitGraphWidth } from "./CommitGraphGutter";
import { CommitRefPicker } from "./CommitRefPicker";

type CommitProject = Pick<EnvironmentProject, "environmentId" | "title">;

const MAX_REF_BADGES = 3;

function CommitRefBadges({
  refs,
  currentBranch,
}: {
  refs: ReadonlyArray<string>;
  currentBranch: string | null;
}) {
  if (refs.length === 0) return null;
  return (
    <>
      {refs.slice(0, MAX_REF_BADGES).map((ref) => {
        const { name, isTag } = commitRefLabel(ref);
        return (
          <Badge
            key={ref}
            variant={isTag ? "outline" : name === currentBranch ? "info" : "secondary"}
            className="max-w-32 shrink"
          >
            {isTag ? <TagIcon aria-hidden /> : null}
            <span className="truncate">{name}</span>
          </Badge>
        );
      })}
      {refs.length > MAX_REF_BADGES ? (
        <Badge variant="outline">+{refs.length - MAX_REF_BADGES}</Badge>
      ) : null}
    </>
  );
}

function CommitDetail({ project, cwd, sha }: { project: CommitProject; cwd: string; sha: string }) {
  const detail = useEnvironmentQuery(
    vcsEnvironment.commitDetail({ environmentId: project.environmentId, input: { cwd, sha } }),
  );
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const data = detail.data;
  return (
    <div className="flex flex-col gap-2 border-t bg-muted/30 px-3 py-2 text-xs">
      <button
        type="button"
        className="inline-flex w-fit max-w-full items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
        aria-label={`Copy commit hash ${sha}`}
        onClick={() => copyToClipboard(sha, undefined)}
      >
        <span className="truncate">{sha}</span>
        {isCopied ? (
          <CheckIcon className="size-3 shrink-0" />
        ) : (
          <CopyIcon className="size-3 shrink-0" />
        )}
      </button>
      {data === null ? (
        detail.error !== null ? (
          <span className="text-destructive-foreground">{detail.error}</span>
        ) : (
          <Spinner className="size-3.5" />
        )
      ) : (
        <>
          {data.body !== "" ? (
            <p className="whitespace-pre-wrap break-words text-foreground">{data.body}</p>
          ) : null}
          {data.files.length === 0 ? (
            <span className="text-muted-foreground">No file changes.</span>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {data.files.map((file) => (
                <li
                  key={`${file.previousPath ?? ""}>${file.path}`}
                  className="flex items-center gap-2 font-mono"
                >
                  <MiddleTruncate
                    value={
                      file.previousPath === null ? file.path : `${file.previousPath} → ${file.path}`
                    }
                    className="min-w-0 flex-1"
                  />
                  <span className="shrink-0 font-mono tabular-nums">
                    {file.additions === null ? (
                      <span className="text-muted-foreground">binary</span>
                    ) : (
                      <>
                        <span className="text-success-foreground">+{file.additions}</span>{" "}
                        <span className="text-destructive-foreground">−{file.deletions}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.truncated ? (
            <span className="text-muted-foreground">
              Only the first {data.files.length} files are listed.
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function CommitRow({
  project,
  cwd,
  commit,
  graphRow,
  laneCount,
  currentBranch,
  expanded,
  onToggle,
}: {
  project: CommitProject;
  cwd: string;
  commit: VcsCommitLogEntry;
  graphRow: ReturnType<typeof layoutCommitGraph>["rows"][number] | null;
  laneCount: number;
  currentBranch: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const shortSha = commit.sha.slice(0, 7);
  const when = commit.authoredAt ? formatRelativeTimeLabel(commit.authoredAt) : "";
  return (
    <div className={cn("flex w-full min-w-0", graphRow === null && "border-b")}>
      {graphRow !== null ? (
        <div
          className="relative shrink-0 self-stretch"
          style={{ width: commitGraphWidth(laneCount) + 8, paddingLeft: 8 }}
        >
          <CommitGraphGutter row={graphRow} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          style={graphRow === null ? undefined : { height: COMMIT_ROW_HEIGHT }}
          className={cn(
            "flex w-full min-w-0 cursor-pointer gap-2 pe-3 text-left hover:bg-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            graphRow === null ? "flex-col gap-1 px-3 py-2.5" : "items-center",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {commit.parents.length > 1 ? (
              <PullRequestGlyph.merged
                aria-label="Merge commit"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            ) : null}
            <span className={cn("min-w-0 truncate text-sm", graphRow === null && "font-medium")}>
              {commit.subject || "(no message)"}
            </span>
            {graphRow === null ? null : (
              <CommitRefBadges refs={commit.refs} currentBranch={currentBranch} />
            )}
          </span>
          {graphRow === null ? (
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{shortSha}</span>
              <span className="min-w-0 truncate">{commit.authorName}</span>
              {when ? <span className="shrink-0">{when}</span> : null}
              <CommitRefBadges refs={commit.refs} currentBranch={currentBranch} />
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden max-w-32 truncate @2xl/commits:inline">
                {commit.authorName}
              </span>
              <span className="hidden font-mono @md/commits:inline">{shortSha}</span>
              {when ? <span>{when}</span> : null}
            </span>
          )}
        </button>
        {expanded ? <CommitDetail project={project} cwd={cwd} sha={commit.sha} /> : null}
      </div>
    </div>
  );
}

/**
 * The toolbar and the commits of one branch, as a list or a graph. The caller keys it by project and
 * branch, so the amount loaded and the open commit start over when either changes.
 */
export function CommitHistory({
  project,
  cwd,
  refName,
  view,
  onRef,
  onView,
}: {
  project: CommitProject;
  /** Where git runs: the project root, or the thread's worktree. */
  cwd: string;
  /** The branch picked, or null for the checked-out one. */
  refName: string | null;
  view: CommitsView;
  onRef: (ref: string) => void;
  onView: (view: CommitsView) => void;
}) {
  const [limit, setLimit] = useState(VCS_COMMIT_LOG_PAGE_SIZE);
  const [openSha, setOpenSha] = useState<string | null>(null);
  const log = useEnvironmentQuery(
    vcsEnvironment.commitLog({
      environmentId: project.environmentId,
      input: { cwd, limit, ...(refName === null ? {} : { ref: refName }) },
    }),
  );
  // Asking for more commits is a new request: keep the loaded ones on screen until it answers.
  const [shown, setShown] = useState<VcsCommitLogResult | null>(null);
  if (log.data !== null && log.data !== shown) setShown(log.data);
  const data = log.data ?? shown;
  const graph = view === "graph" && data !== null ? layoutCommitGraph(data.commits) : null;
  const currentBranch = data?.currentBranch ?? null;
  const loadingMore = log.isPending && data !== null && data.commits.length < limit;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <CommitRefPicker
          environmentId={project.environmentId}
          cwd={cwd}
          value={refName}
          label={currentBranch ?? "HEAD"}
          onChange={onRef}
        />
        <ToggleGroup
          aria-label="Commit view"
          value={[view]}
          onValueChange={(next) => {
            const picked = next[0];
            if (picked === "list" || picked === "graph") onView(picked);
          }}
        >
          <Toggle value="list" aria-label="List">
            <ListIcon />
          </Toggle>
          <Toggle value="graph" aria-label="Graph">
            <GitGraphIcon />
          </Toggle>
        </ToggleGroup>
        <span className="flex-1" />
        <ListRefreshButton
          label="Refresh commits"
          refreshing={log.isPending}
          onRefresh={log.refresh}
        />
      </div>
      <div className="@container/commits min-h-0 flex-1 overflow-y-auto">
        {data === null ? (
          log.error !== null ? (
            <div className="flex flex-col items-start gap-2 p-4 text-sm">
              <span className="text-destructive-foreground">{log.error}</span>
              <Button size="compact" variant="outline" onClick={log.refresh}>
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
              <EmptyDescription>{project.title} has no commits to list.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : data.commits.length === 0 ? (
          <Empty size="compact">
            <EmptyHeader>
              <EmptyTitle>No commits</EmptyTitle>
              <EmptyDescription>
                {refName === ALL_VCS_REFS
                  ? "No branch has a commit yet."
                  : "This branch has no commits yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {data.commits.map((commit, index) => (
              <CommitRow
                key={commit.sha}
                project={project}
                cwd={cwd}
                commit={commit}
                graphRow={graph?.rows[index] ?? null}
                laneCount={graph?.laneCount ?? 0}
                currentBranch={currentBranch}
                expanded={openSha === commit.sha}
                onToggle={() => setOpenSha(openSha === commit.sha ? null : commit.sha)}
              />
            ))}
            {data.hasMore ? (
              limit < VCS_COMMIT_LOG_MAX_LIMIT ? (
                <div className="flex justify-center p-3">
                  <Button
                    size="compact"
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => setLimit(nextCommitLogLimit(limit, VCS_COMMIT_LOG_MAX_LIMIT))}
                  >
                    {loadingMore ? <Spinner className="size-3" /> : null}
                    Load more
                  </Button>
                </div>
              ) : (
                <p className="p-3 text-xs text-muted-foreground">
                  Showing the latest {data.commits.length} commits.
                </p>
              )
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
