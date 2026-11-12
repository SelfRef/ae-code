import type {
  OrchestrationProjectShell,
  PullRequestRef,
  PullRequestReviewCommentDraft,
  PullRequestReviewerRequestInput,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as IssueService from "../../../issue/IssueService.ts";
import * as Orchestrator from "../../../orchestration-v2/Orchestrator.ts";
import * as ProjectService from "../../../project/ProjectService.ts";
import * as PullRequestService from "../../../pullRequest/PullRequestService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { resolveTarget } from "../../../pullRequest/pullRequestTarget.ts";
import { projectForPullRequest } from "../pullRequests/handlers.ts";
import {
  PullRequestProjectNotFoundError,
  type PullRequestTargetInput,
} from "../pullRequests/tools.ts";
import {
  type IssueListItem,
  type ReviewLineComment,
  SourceControlInvalidRequestError,
  SourceControlProjectRequiredError,
  SourceControlRequestFailedError,
  SourceControlToolkit,
} from "./tools.ts";

const DEFAULT_LIST_LIMIT = 30;

const logins = (actors: ReadonlyArray<{ readonly login: string }>) =>
  actors.map((actor) => actor.login);

const failed = (error: { readonly message: string }) =>
  new SourceControlRequestFailedError({ detail: error.message });

const invalid = (detail: string) => new SourceControlInvalidRequestError({ detail });

/** `team:<slug>` names a team; any other name is a user. */
const reviewerOf = (name: string): PullRequestReviewerRequestInput["reviewers"][number] =>
  name.startsWith("team:")
    ? { id: name.slice("team:".length), kind: "team" }
    : { id: name, kind: "user" };

const reviewCommentOf = (comment: ReviewLineComment): PullRequestReviewCommentDraft => ({
  path: comment.path,
  position:
    comment.side === "old"
      ? { kind: "deleted", oldLine: comment.line }
      : { kind: "added", newLine: comment.line },
  body: comment.body,
});

const issueItemOf = (issue: {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: IssueListItem["state"];
  readonly stateReason?: IssueListItem["stateReason"] | undefined;
  readonly author: { readonly login: string } | null;
  readonly assignees: ReadonlyArray<{ readonly login: string }>;
  readonly labels: ReadonlyArray<{ readonly name: string }>;
  readonly commentCount: number;
  readonly updatedAt: string;
}): IssueListItem => ({
  number: issue.number,
  title: issue.title,
  url: issue.url,
  state: issue.state,
  stateReason: issue.stateReason ?? null,
  author: issue.author?.login ?? null,
  assignees: logins(issue.assignees),
  labels: issue.labels.map((label) => label.name),
  commentCount: issue.commentCount,
  updatedAt: issue.updatedAt,
});

const make = Effect.gen(function* () {
  const engine = yield* Orchestrator.OrchestratorV2;
  const projects = yield* ProjectService.ProjectService;
  const pullRequests = yield* PullRequestService.PullRequestService;
  const issues = yield* IssueService.IssueService;

  /** The project of the thread the call comes from, when it comes from one. */
  const callerProject = Effect.fn("SourceControlToolkit.callerProject")(function* (
    requested?: ThreadId,
  ) {
    const scope = yield* McpInvocationContext.requireMcpCapability("pull-requests");
    const threadId = requested ?? scope.thread?.threadId;
    if (threadId === undefined) return undefined;
    const thread = yield* engine.getThreadShell(threadId).pipe(Effect.orElseSucceed(() => null));
    if (thread === null || thread.deletedAt !== null) return undefined;
    return yield* projects.getShell(thread.projectId).pipe(
      Effect.map(Option.getOrUndefined),
      Effect.orElseSucceed((): OrchestrationProjectShell | undefined => undefined),
    );
  });

  const projectIdOf = Effect.fn("SourceControlToolkit.projectIdOf")(function* (
    requested: ProjectId | undefined,
  ) {
    if (requested !== undefined) return requested;
    const project = yield* callerProject();
    if (project === undefined) return yield* new SourceControlProjectRequiredError();
    return project.id;
  });

  const locate = Effect.fn("SourceControlToolkit.locate")(function* (
    input: PullRequestTargetInput,
  ) {
    const preferred = yield* callerProject(input.threadId);
    const known = yield* projects.listShells().pipe(Effect.mapError(failed));
    // A pull request named by host and repository builds its URL through the project that
    // holds it, which need not be the caller's.
    const urlProject =
      input.url === undefined && input.host !== undefined && input.repository !== undefined
        ? (projectForPullRequest(
            known,
            { host: input.host, repository: input.repository },
            preferred,
          ) ?? preferred)
        : preferred;
    const target = yield* resolveTarget(input, urlProject);
    const project = projectForPullRequest(known, target, preferred);
    if (project === undefined) {
      return yield* new PullRequestProjectNotFoundError({ repository: target.repository });
    }
    const ref: PullRequestRef = {
      projectId: project.id,
      host: target.host,
      repository: target.repository,
      number: target.number,
    };
    return { target, ref };
  });

  /** Reads and writes go out as the host account the pull request's project is set up with. */
  const asViewer = <A>(
    ref: PullRequestRef,
    operation: Effect.Effect<A, { readonly message: string }>,
  ) => pullRequests.withRoutingCredential(ref, operation).pipe(Effect.mapError(failed));

  return {
    list_pull_requests: McpToolAccess.reads((input) =>
      Effect.gen(function* () {
        const projectId = input.projectId ?? (yield* callerProject())?.id;
        const result = yield* pullRequests
          .list({
            state: input.state ?? "open",
            ...(input.involvement === undefined ? {} : { involvement: input.involvement }),
            ...(projectId === undefined ? {} : { projectId }),
            ...(input.query === undefined ? {} : { query: input.query }),
            limit: input.limit ?? DEFAULT_LIST_LIMIT,
          })
          .pipe(Effect.mapError(failed));
        return {
          pullRequests: result.entries.map((entry) => ({
            repository: entry.repository,
            number: entry.number,
            title: entry.title,
            url: entry.url,
            author: entry.author?.login ?? null,
            state: entry.state,
            isDraft: entry.isDraft,
            headBranch: entry.headBranch,
            baseBranch: entry.baseBranch,
            checks: entry.checksState ?? null,
            review: entry.reviewDecision ?? null,
            labels: entry.labels.map((label) => label.name),
            updatedAt: entry.updatedAt,
          })),
          errors: result.errors.map((error) => `${error.projectTitle}: ${error.message}`),
          truncated: result.truncated,
        };
      }),
    ),
    read_pull_request: McpToolAccess.reads((input) =>
      Effect.gen(function* () {
        const { ref } = yield* locate(input);
        const [detail, activity] = yield* Effect.all(
          [
            asViewer(ref, pullRequests.detail(ref)),
            input.activity === true ? asViewer(ref, pullRequests.activity(ref)) : Effect.undefined,
          ],
          { concurrency: 2 },
        );
        return {
          repository: detail.repository,
          number: detail.number,
          url: detail.url,
          title: detail.title,
          body: detail.body,
          state: detail.state,
          isDraft: detail.isDraft,
          author: detail.author?.login ?? null,
          headBranch: detail.headBranch,
          baseBranch: detail.baseBranch,
          headSha: detail.headSha ?? null,
          mergeability: detail.mergeability,
          additions: detail.additions,
          deletions: detail.deletions,
          changedFiles: detail.changedFiles,
          labels: detail.labels.map((label) => label.name),
          reviewers: logins(detail.reviewers),
          checks: detail.checks.map((check) => ({
            name: check.name,
            status: check.status,
            url: check.url,
            required: check.required ?? null,
          })),
          behindBy: detail.behindBy ?? null,
          autoMergeEnabled: detail.autoMergeEnabled ?? null,
          ...(activity === undefined
            ? {}
            : {
                activity: {
                  comments: activity.comments.map((comment) => ({
                    kind: comment.kind,
                    author: comment.author?.login ?? null,
                    body: comment.body,
                    createdAt: comment.createdAt,
                    path: comment.path,
                    reviewState: comment.reviewState,
                  })),
                  commentsTruncated: activity.commentsTruncated,
                  reviewThreads: activity.reviewThreads.map((thread) => ({
                    id: thread.id,
                    path: thread.path,
                    line: thread.line,
                    isResolved: thread.isResolved,
                    isOutdated: thread.isOutdated,
                    comments: thread.comments.map((comment) => ({
                      author: comment.author?.login ?? null,
                      body: comment.body,
                      createdAt: comment.createdAt,
                    })),
                  })),
                  reviewThreadsTruncated: activity.reviewThreadsTruncated ?? false,
                },
              }),
        };
      }),
    ),
    comment_on_pull_request: McpToolAccess.writesWithCapability((input) =>
      Effect.gen(function* () {
        const { target, ref } = yield* locate(input);
        const identity = { repository: target.repository, number: target.number };
        if (input.reviewThreadId === undefined) {
          if (input.body === undefined) return yield* invalid("Pass body, or reviewThreadId.");
          yield* asViewer(ref, pullRequests.comment({ ...ref, body: input.body }));
          return { ...identity, posted: true, resolved: null };
        }
        if (input.body === undefined && input.resolved === undefined) {
          return yield* invalid("Pass body to reply, resolved to resolve the thread, or both.");
        }
        const threadId = input.reviewThreadId;
        if (input.body !== undefined) {
          yield* asViewer(ref, pullRequests.replyToThread({ ...ref, threadId, body: input.body }));
        }
        if (input.resolved !== undefined) {
          yield* asViewer(
            ref,
            pullRequests.setThreadResolution({ ...ref, threadId, resolved: input.resolved }),
          );
        }
        return { ...identity, posted: input.body !== undefined, resolved: input.resolved ?? null };
      }),
    ),
    review_pull_request: McpToolAccess.writesWithCapability((input) =>
      Effect.gen(function* () {
        const { target, ref } = yield* locate(input);
        const comments = (input.comments ?? []).map(reviewCommentOf);
        yield* asViewer(
          ref,
          pullRequests.submitReview({
            ...ref,
            verdict: input.verdict,
            body: input.body ?? "",
            comments,
          }),
        );
        return {
          repository: target.repository,
          number: target.number,
          verdict: input.verdict,
          commentCount: comments.length,
        };
      }),
    ),
    update_pull_request: McpToolAccess.writesWithCapability((input) =>
      Effect.gen(function* () {
        const { target, ref } = yield* locate(input);
        const changed: Array<string> = [];
        if (input.title !== undefined || input.body !== undefined) {
          yield* asViewer(
            ref,
            pullRequests.update({
              ...ref,
              ...(input.title === undefined ? {} : { title: input.title }),
              ...(input.body === undefined ? {} : { body: input.body }),
            }),
          );
          if (input.title !== undefined) changed.push("title");
          if (input.body !== undefined) changed.push("body");
        }
        const labelChanges = [
          ["addLabels", input.addLabels, true],
          ["removeLabels", input.removeLabels, false],
        ] as const;
        for (const [field, labels, applied] of labelChanges) {
          if (labels === undefined || labels.length === 0) continue;
          yield* asViewer(ref, pullRequests.setLabels({ ...ref, labels, applied }));
          changed.push(field);
        }
        const reviewerChanges = [
          ["requestReviewers", input.requestReviewers, true],
          ["cancelReviewers", input.cancelReviewers, false],
        ] as const;
        for (const [field, names, requested] of reviewerChanges) {
          if (names === undefined || names.length === 0) continue;
          yield* asViewer(
            ref,
            pullRequests.requestReviewers({ ...ref, reviewers: names.map(reviewerOf), requested }),
          );
          changed.push(field);
        }
        if (changed.length === 0) return yield* invalid("Pass at least one field to change.");
        return { repository: target.repository, number: target.number, changed };
      }),
    ),
    act_on_pull_request: McpToolAccess.writesWithCapability((input) =>
      Effect.gen(function* () {
        const { target, ref } = yield* locate(input);
        const summary = yield* asViewer(
          ref,
          pullRequests.runAction({
            ...ref,
            action: input.action,
            ...(input.mergeMethod === undefined ? {} : { mergeMethod: input.mergeMethod }),
            ...(input.updateMethod === undefined ? {} : { updateMethod: input.updateMethod }),
            replyWithSummary: true,
          }),
        );
        return {
          repository: target.repository,
          number: target.number,
          url: target.url,
          action: input.action,
          state: summary?.state ?? null,
          isDraft: summary?.isDraft ?? null,
        };
      }),
    ),
    list_issues: McpToolAccess.reads((input) =>
      Effect.gen(function* () {
        const projectId = yield* projectIdOf(input.projectId);
        const result = yield* issues
          .list({
            projectId,
            state: input.state ?? "open",
            ...(input.sort === undefined ? {} : { sort: input.sort }),
            ...(input.query === undefined ? {} : { query: input.query }),
            ...(input.page === undefined ? {} : { page: input.page }),
          })
          .pipe(Effect.mapError(failed));
        return {
          repository: result.repository,
          issues: result.issues.map(issueItemOf),
          hasMore: result.hasMore,
        };
      }),
    ),
    read_issue: McpToolAccess.reads((input) =>
      Effect.gen(function* () {
        const projectId = yield* projectIdOf(input.projectId);
        const issue = yield* issues
          .read({ projectId, number: input.number })
          .pipe(Effect.mapError(failed));
        return {
          ...issueItemOf(issue),
          repository: issue.repository,
          body: issue.body,
          comments: issue.comments.map((comment) => ({
            author: comment.author?.login ?? null,
            body: comment.body,
            createdAt: comment.createdAt,
          })),
          commentsTruncated: issue.commentsTruncated,
        };
      }),
    ),
    create_issue: McpToolAccess.writesWithCapability((input) =>
      Effect.gen(function* () {
        const projectId = yield* projectIdOf(input.projectId);
        const issue = yield* issues
          .create({
            projectId,
            title: input.title,
            ...(input.body === undefined ? {} : { body: input.body }),
            ...(input.labels === undefined ? {} : { labels: input.labels }),
            ...(input.assignees === undefined ? {} : { assignees: input.assignees }),
          })
          .pipe(Effect.mapError(failed));
        return issueItemOf(issue);
      }),
    ),
    update_issue: McpToolAccess.writesWithCapability((input) =>
      Effect.gen(function* () {
        const projectId = yield* projectIdOf(input.projectId);
        if (input.stateReason !== undefined && input.state !== "closed") {
          return yield* invalid("stateReason needs state: closed.");
        }
        const issue = yield* issues
          .update({
            projectId,
            number: input.number,
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.body === undefined ? {} : { body: input.body }),
            ...(input.state === undefined ? {} : { state: input.state }),
            ...(input.stateReason === undefined ? {} : { stateReason: input.stateReason }),
            ...(input.labels === undefined ? {} : { labels: input.labels }),
            ...(input.assignees === undefined ? {} : { assignees: input.assignees }),
            ...(input.comment === undefined ? {} : { comment: input.comment }),
          })
          .pipe(Effect.mapError(failed));
        return issueItemOf(issue);
      }),
    ),
  } satisfies McpToolAccess.Handlers<typeof SourceControlToolkit.tools>;
});

export const layer = McpToolAccess.toLayer(SourceControlToolkit, make);
