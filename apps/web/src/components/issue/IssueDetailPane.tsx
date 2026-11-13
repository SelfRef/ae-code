import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { ExternalLinkIcon, MessageSquarePlusIcon } from "lucide-react";
import { useState } from "react";

import { useNewThreadHandler } from "~/hooks/useHandleNewThread";

import { useEnvironmentQuery } from "~/state/query";
import { issueEnvironment } from "~/state/issues";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { toastManager } from "../ui/toast";
import { writeHandoffToComposer } from "../pullRequest/usePullRequestActions";
import { PullRequestLabelChip } from "../pullRequest/pullRequestPresentation";
import { PullRequestMarkdown } from "../pullRequest/PullRequestMarkdown";
import { buildIssueContext, issueContextBody } from "./issueContext";
import { IssueStateGlyph } from "./IssueStateGlyph";

function Author({ login, at }: { login: string | undefined; at: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{login ?? "Someone"}</span>{" "}
      {formatRelativeTimeLabel(at)}
    </span>
  );
}

export function IssueDetailPane({
  environmentId,
  projectId,
  workspaceRoot,
  number,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  workspaceRoot: string;
  number: number;
}) {
  const result = useEnvironmentQuery(
    issueEnvironment.detail({ environmentId, input: { projectId, number } }),
  );
  const issue = result.data;
  const newThread = useNewThreadHandler();
  const [starting, setStarting] = useState(false);
  const startThread = async () => {
    if (issue === null || starting) return;
    setStarting(true);
    const session = await newThread(scopeProjectRef(environmentId, projectId)).then(
      (opened) => opened,
      () => null,
    );
    setStarting(false);
    if (session === null) {
      toastManager.add({
        type: "error",
        title: "Could not open a thread",
        description: "Try again from the project, or open a thread first.",
      });
      return;
    }
    writeHandoffToComposer(session.draftId, {
      prompt: `Work on issue #${issue.number}.`,
      reviewComments: [buildIssueContext({ ...issue, body: issueContextBody(issue) })],
    });
  };
  if (issue === null) {
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
          <h2 className="text-lg leading-snug font-semibold">
            {issue.title} <span className="font-normal text-muted-foreground">#{issue.number}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={issue.state === "open" ? "success" : "secondary"}>
              <IssueStateGlyph issue={issue} className="size-3.5" />
              {issue.state === "open"
                ? "Open"
                : issue.stateReason === "not-planned"
                  ? "Closed as not planned"
                  : "Closed"}
            </Badge>
            <Author login={issue.author?.login} at={issue.createdAt} />
            <Button
              size="compact"
              variant="outline"
              className="ms-auto"
              disabled={starting}
              onClick={() => void startThread()}
            >
              <MessageSquarePlusIcon /> Work on this
            </Button>
            <Button
              size="compact"
              variant="ghost-muted"
              render={<a href={issue.url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLinkIcon /> Open on GitHub
            </Button>
          </div>
          {issue.labels.length > 0 || issue.assignees.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {issue.labels.map((label) => (
                <PullRequestLabelChip key={label.name} label={label} />
              ))}
              {issue.assignees.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Assigned to {issue.assignees.map((assignee) => assignee.login).join(", ")}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>
        {issue.body.trim().length > 0 ? (
          <PullRequestMarkdown
            text={issue.body}
            cwd={workspaceRoot}
            environmentId={environmentId}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">No description provided.</p>
        )}
        {issue.comments.map((comment) => (
          <section key={comment.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <Author login={comment.author?.login} at={comment.createdAt} />
            <PullRequestMarkdown
              text={comment.body}
              cwd={workspaceRoot}
              environmentId={environmentId}
            />
          </section>
        ))}
        {issue.commentsTruncated ? (
          <Button
            size="compact"
            variant="outline"
            render={<a href={issue.url} target="_blank" rel="noreferrer" />}
          >
            More comments on GitHub
          </Button>
        ) : null}
      </div>
    </article>
  );
}
