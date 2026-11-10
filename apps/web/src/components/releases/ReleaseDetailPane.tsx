import type { EnvironmentId, ProjectId, ReleaseSummary } from "@t3tools/contracts";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";

import { formatBytes } from "~/lib/formatBytes";
import { issueEnvironment } from "~/state/issues";
import { useEnvironmentQuery } from "~/state/query";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { PullRequestMarkdown } from "../pullRequest/PullRequestMarkdown";

export function ReleaseBadges({
  release,
}: {
  release: Pick<ReleaseSummary, "draft" | "prerelease">;
}) {
  return (
    <>
      {release.draft ? <Badge variant="secondary">Draft</Badge> : null}
      {release.prerelease ? <Badge variant="warning">Pre-release</Badge> : null}
    </>
  );
}

export function ReleaseDetailPane({
  environmentId,
  projectId,
  workspaceRoot,
  id,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  workspaceRoot: string;
  id: number;
}) {
  const result = useEnvironmentQuery(
    issueEnvironment.releaseDetail({ environmentId, input: { projectId, id } }),
  );
  const release = result.data;
  if (release === null) {
    return result.error !== null ? (
      <div className="flex flex-col items-start gap-2 p-4 text-sm">
        <span className="text-destructive-foreground">{result.error}</span>
        <Button size="compact" variant="outline" onClick={result.refresh}>
          Try again
        </Button>
      </div>
    ) : (
      <div className="flex justify-center p-8">
        <Spinner className="size-4" />
      </div>
    );
  }
  return (
    <article className="h-full min-h-0 overflow-y-auto scrollbar-gutter-both p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h2 className="text-lg leading-snug font-semibold">{release.name || release.tagName}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{release.tagName}</Badge>
            <ReleaseBadges release={release} />
            <span className="text-xs text-muted-foreground">
              {release.author ? (
                <span className="font-medium text-foreground">{release.author.login} </span>
              ) : null}
              {formatRelativeTimeLabel(release.publishedAt ?? release.createdAt)}
              {release.targetCommitish
                ? ` · ${release.targetCommitish.replace(/^([0-9a-f]{7})[0-9a-f]{33}$/, "$1")}`
                : ""}
            </span>
            <Button
              size="compact"
              variant="ghost-muted"
              className="ms-auto"
              render={<a href={release.url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLinkIcon /> Open on GitHub
            </Button>
          </div>
        </header>
        {release.body.trim().length > 0 ? (
          <PullRequestMarkdown
            text={release.body}
            cwd={workspaceRoot}
            environmentId={environmentId}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">No release notes.</p>
        )}
        {release.assets.length > 0 ? (
          <section className="flex flex-col rounded-lg border">
            <h3 className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Assets</h3>
            {release.assets.map((asset) => (
              <a
                key={asset.name}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent/50"
              >
                <DownloadIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(asset.size)} · {asset.downloadCount} downloads
                </span>
              </a>
            ))}
          </section>
        ) : null}
      </div>
    </article>
  );
}
