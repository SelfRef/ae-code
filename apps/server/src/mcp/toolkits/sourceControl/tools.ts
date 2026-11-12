import {
  IssueListSort,
  IssueListState,
  IssueState,
  IssueStateReason,
  McpCapabilityUnavailableError,
  OrchestratorMcpEnvironmentTarget,
  OrchestratorMcpFailure,
  PositiveInt,
  ProjectId,
  PullRequestAction,
  PullRequestChecksState,
  PullRequestInvolvement,
  PullRequestListState,
  PullRequestMergeMethod,
  PullRequestMergeability,
  PullRequestReviewDecision,
  PullRequestReviewVerdict,
  PullRequestState,
  PullRequestUpdateMethod,
  TrimmedNonEmptyString,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import * as Orchestrator from "../../../orchestration-v2/Orchestrator.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as ProjectService from "../../../project/ProjectService.ts";
import * as IssueService from "../../../issue/IssueService.ts";
import * as PullRequestService from "../../../pullRequest/PullRequestService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import {
  PullRequestHostRequiredError,
  PullRequestProjectNotFoundError,
  PullRequestTargetIncompleteError,
  PullRequestTargetInput,
  PullRequestUrlInvalidError,
  PullRequestUrlUnavailableError,
} from "../pullRequests/tools.ts";

const dependencies = [
  McpInvocationContext.McpInvocationContext,
  ThreadManagementService.ThreadManagementService,
  Orchestrator.OrchestratorV2,
  ProjectService.ProjectService,
  PullRequestService.PullRequestService,
  IssueService.IssueService,
];

export class SourceControlRequestFailedError extends Schema.TaggedError<SourceControlRequestFailedError>()(
  "SourceControlRequestFailedError",
  { detail: Schema.String },
) {
  override get message(): string {
    return this.detail;
  }
}

export class SourceControlInvalidRequestError extends Schema.TaggedError<SourceControlInvalidRequestError>()(
  "SourceControlInvalidRequestError",
  { detail: Schema.String },
) {
  override get message(): string {
    return this.detail;
  }
}

export class SourceControlProjectRequiredError extends Schema.TaggedError<SourceControlProjectRequiredError>()(
  "SourceControlProjectRequiredError",
  {},
) {
  override get message(): string {
    return "Pass projectId: this MCP client is not running inside a T3 thread.";
  }
}

export const SourceControlToolError = Schema.Union([
  OrchestratorMcpFailure,
  McpCapabilityUnavailableError,
  PullRequestUrlInvalidError,
  PullRequestTargetIncompleteError,
  PullRequestHostRequiredError,
  PullRequestUrlUnavailableError,
  PullRequestProjectNotFoundError,
  SourceControlRequestFailedError,
  SourceControlInvalidRequestError,
  SourceControlProjectRequiredError,
]);
export type SourceControlToolError = typeof SourceControlToolError.Type;

const MarkdownBody = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(65_536));
const Names = Schema.Array(TrimmedNonEmptyString).check(Schema.isMaxLength(25));

const ProjectTarget = {
  environmentId: OrchestratorMcpEnvironmentTarget,
  projectId: Schema.optional(
    ProjectId.annotate({ description: "Default: this thread's project." }),
  ),
};

const Actor = Schema.NullOr(Schema.String).annotate({ description: "Login." });

export const PullRequestListItem = Schema.Struct({
  repository: Schema.String,
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  author: Actor,
  state: PullRequestState,
  isDraft: Schema.Boolean,
  headBranch: Schema.String,
  baseBranch: Schema.String,
  checks: Schema.NullOr(PullRequestChecksState),
  review: Schema.NullOr(PullRequestReviewDecision),
  labels: Schema.Array(Schema.String),
  updatedAt: Schema.String,
});

export const ListPullRequestsResult = Schema.Struct({
  pullRequests: Schema.Array(PullRequestListItem),
  errors: Schema.Array(Schema.String),
  truncated: Schema.Boolean,
});
export type ListPullRequestsResult = typeof ListPullRequestsResult.Type;

export const PullRequestActivityResult = Schema.Struct({
  comments: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(["issue-comment", "review-comment", "review"]),
      author: Actor,
      body: Schema.String,
      createdAt: Schema.String,
      path: Schema.NullOr(Schema.String),
      reviewState: Schema.NullOr(Schema.String),
    }),
  ),
  commentsTruncated: Schema.Boolean,
  reviewThreads: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      path: Schema.String,
      line: Schema.NullOr(Schema.Int),
      isResolved: Schema.Boolean,
      isOutdated: Schema.Boolean,
      comments: Schema.Array(
        Schema.Struct({ author: Actor, body: Schema.String, createdAt: Schema.String }),
      ),
    }),
  ),
  reviewThreadsTruncated: Schema.Boolean,
});

export const ReadPullRequestResult = Schema.Struct({
  repository: Schema.String,
  number: Schema.Int,
  url: Schema.String,
  title: Schema.String,
  body: Schema.String,
  state: PullRequestState,
  isDraft: Schema.Boolean,
  author: Actor,
  headBranch: Schema.String,
  baseBranch: Schema.String,
  headSha: Schema.NullOr(Schema.String),
  mergeability: PullRequestMergeability,
  additions: Schema.Int,
  deletions: Schema.Int,
  changedFiles: Schema.Int,
  labels: Schema.Array(Schema.String),
  reviewers: Schema.Array(Schema.String),
  checks: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      status: Schema.String,
      url: Schema.NullOr(Schema.String),
      required: Schema.NullOr(Schema.Boolean),
    }),
  ),
  behindBy: Schema.NullOr(Schema.Int),
  autoMergeEnabled: Schema.NullOr(Schema.Boolean),
  activity: Schema.optional(PullRequestActivityResult),
});
export type ReadPullRequestResult = typeof ReadPullRequestResult.Type;

export const CommentOnPullRequestResult = Schema.Struct({
  repository: Schema.String,
  number: Schema.Int,
  posted: Schema.Boolean,
  resolved: Schema.NullOr(Schema.Boolean),
});
export type CommentOnPullRequestResult = typeof CommentOnPullRequestResult.Type;

export const ReviewPullRequestResult = Schema.Struct({
  repository: Schema.String,
  number: Schema.Int,
  verdict: PullRequestReviewVerdict,
  commentCount: Schema.Int,
});
export type ReviewPullRequestResult = typeof ReviewPullRequestResult.Type;

export const UpdatePullRequestResult = Schema.Struct({
  repository: Schema.String,
  number: Schema.Int,
  changed: Schema.Array(Schema.String),
});
export type UpdatePullRequestResult = typeof UpdatePullRequestResult.Type;

export const ActOnPullRequestResult = Schema.Struct({
  repository: Schema.String,
  number: Schema.Int,
  url: Schema.String,
  action: PullRequestAction,
  state: Schema.NullOr(PullRequestState),
  isDraft: Schema.NullOr(Schema.Boolean),
});
export type ActOnPullRequestResult = typeof ActOnPullRequestResult.Type;

export const IssueListItem = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  state: IssueState,
  stateReason: Schema.NullOr(IssueStateReason),
  author: Actor,
  assignees: Schema.Array(Schema.String),
  labels: Schema.Array(Schema.String),
  commentCount: Schema.Int,
  updatedAt: Schema.String,
});
export type IssueListItem = typeof IssueListItem.Type;

export const ListIssuesResult = Schema.Struct({
  repository: Schema.String,
  issues: Schema.Array(IssueListItem),
  hasMore: Schema.Boolean,
});
export type ListIssuesResult = typeof ListIssuesResult.Type;

export const ReadIssueResult = Schema.Struct({
  ...IssueListItem.fields,
  repository: Schema.String,
  body: Schema.String,
  comments: Schema.Array(
    Schema.Struct({ author: Actor, body: Schema.String, createdAt: Schema.String }),
  ),
  commentsTruncated: Schema.Boolean,
});
export type ReadIssueResult = typeof ReadIssueResult.Type;

const ReviewLineComment = Schema.Struct({
  path: TrimmedNonEmptyString,
  line: PositiveInt,
  side: Schema.optional(
    Schema.Literals(["new", "old"]).annotate({
      description: "new (default): the PR's file. old: the base's, for a removed line.",
    }),
  ),
  body: MarkdownBody,
});
export type ReviewLineComment = typeof ReviewLineComment.Type;

const ListPullRequestsTool = Tool.make("list_pull_requests", {
  description:
    "List PRs of a project's repository, newest update first. Read one with `read_pull_request`.",
  parameters: Schema.Struct({
    ...ProjectTarget,
    state: Schema.optional(PullRequestListState.annotate({ description: "Default: open." })),
    involvement: Schema.optional(PullRequestInvolvement),
    query: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
    limit: Schema.optional(
      Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })).annotate({
        description: "Default: 30.",
      }),
    ),
  }),
  success: ListPullRequestsResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "List pull requests")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

const ReadPullRequestTool = Tool.make("read_pull_request", {
  description:
    "Read a PR: description, state, mergeability, checks, reviewers. `activity` adds comments, reviews and review threads, with the thread ids `comment_on_pull_request` replies to.",
  parameters: Schema.Struct({
    ...PullRequestTargetInput.fields,
    activity: Schema.optional(Schema.Boolean),
  }),
  success: ReadPullRequestResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Read pull request")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

const CommentOnPullRequestTool = Tool.make("comment_on_pull_request", {
  description:
    "Comment on a PR. With `reviewThreadId` (from `read_pull_request` activity), reply to that review thread instead. `resolved` then resolves or reopens it, and `body` may be left out.",
  parameters: Schema.Struct({
    ...PullRequestTargetInput.fields,
    body: Schema.optional(MarkdownBody),
    reviewThreadId: Schema.optional(TrimmedNonEmptyString),
    resolved: Schema.optional(Schema.Boolean),
  }),
  success: CommentOnPullRequestResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Comment on pull request")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

const ReviewPullRequestTool = Tool.make("review_pull_request", {
  description:
    "Submit a review of a PR: `approve`, `request-changes` or `comment`, with a summary and inline `comments` on diff lines. Approve or request changes only when the user asked for that verdict.",
  parameters: Schema.Struct({
    ...PullRequestTargetInput.fields,
    verdict: PullRequestReviewVerdict,
    body: Schema.optional(Schema.String.check(Schema.isMaxLength(65_536))),
    comments: Schema.optional(Schema.Array(ReviewLineComment).check(Schema.isMaxLength(100))),
  }),
  success: ReviewPullRequestResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Review pull request")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

const UpdatePullRequestTool = Tool.make("update_pull_request", {
  description:
    "Change a PR's title or description, add or remove labels, request or cancel reviewers (a login, or `team:<slug>`). Only what you pass changes.",
  parameters: Schema.Struct({
    ...PullRequestTargetInput.fields,
    title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(1024))),
    body: Schema.optional(Schema.String.check(Schema.isMaxLength(65_536))),
    addLabels: Schema.optional(Names),
    removeLabels: Schema.optional(Names),
    requestReviewers: Schema.optional(Names),
    cancelReviewers: Schema.optional(Names),
  }),
  success: UpdatePullRequestResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Update pull request")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

const ActOnPullRequestTool = Tool.make("act_on_pull_request", {
  description:
    "Run an action on a PR: merge (`mergeMethod`), ready, draft, close, reopen, delete-branch, update-branch (`updateMethod`), enable-auto-merge, disable-auto-merge, revert, approve-workflows. Merge, close or delete a branch only when the user asked.",
  parameters: Schema.Struct({
    ...PullRequestTargetInput.fields,
    action: PullRequestAction,
    mergeMethod: Schema.optional(PullRequestMergeMethod),
    updateMethod: Schema.optional(PullRequestUpdateMethod),
  }),
  success: ActOnPullRequestResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Act on pull request")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

const ListIssuesTool = Tool.make("list_issues", {
  description:
    "List issues of a project's repository. `query` takes the host's search syntax, such as `label:bug author:@me`.",
  parameters: Schema.Struct({
    ...ProjectTarget,
    state: Schema.optional(IssueListState.annotate({ description: "Default: open." })),
    sort: Schema.optional(IssueListSort),
    query: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
    page: Schema.optional(PositiveInt),
  }),
  success: ListIssuesResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "List issues")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

const ReadIssueTool = Tool.make("read_issue", {
  description: "Read an issue with its description and first comments.",
  parameters: Schema.Struct({ ...ProjectTarget, number: PositiveInt }),
  success: ReadIssueResult,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Read issue")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

const CreateIssueTool = Tool.make("create_issue", {
  description: "Open an issue in a project's repository.",
  parameters: Schema.Struct({
    ...ProjectTarget,
    title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
    body: Schema.optional(Schema.String.check(Schema.isMaxLength(65_536))),
    labels: Schema.optional(Names),
    assignees: Schema.optional(Names),
  }),
  success: IssueListItem,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Create issue")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

const UpdateIssueTool = Tool.make("update_issue", {
  description:
    "Change an issue: title, body, `state` (closed takes `stateReason`), `labels` and `assignees` (each replaces the whole set), and add a `comment`. Only what you pass changes.",
  parameters: Schema.Struct({
    ...ProjectTarget,
    number: PositiveInt,
    title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(256))),
    body: Schema.optional(Schema.String.check(Schema.isMaxLength(65_536))),
    state: Schema.optional(IssueState),
    stateReason: Schema.optional(Schema.Literals(["completed", "not-planned"])),
    labels: Schema.optional(Names),
    assignees: Schema.optional(Names),
    comment: Schema.optional(MarkdownBody),
  }),
  success: IssueListItem,
  failure: SourceControlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Update issue")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

export const SourceControlToolkit = Toolkit.make(
  ListPullRequestsTool,
  ReadPullRequestTool,
  CommentOnPullRequestTool,
  ReviewPullRequestTool,
  UpdatePullRequestTool,
  ActOnPullRequestTool,
  ListIssuesTool,
  ReadIssueTool,
  CreateIssueTool,
  UpdateIssueTool,
);
