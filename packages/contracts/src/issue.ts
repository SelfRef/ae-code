import * as Schema from "effect/Schema";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import {
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import { PullRequestActor, PullRequestLabel } from "./pullRequest.ts";

export const IssueState = Schema.Literals(["open", "closed"]);
export type IssueState = typeof IssueState.Type;

export const IssueStateReason = Schema.Literals(["completed", "not-planned", "reopened"]);
export type IssueStateReason = typeof IssueStateReason.Type;

export const IssueListState = Schema.Literals(["open", "closed", "all"]);
export type IssueListState = typeof IssueListState.Type;

export const IssueListInput = Schema.Struct({
  projectId: ProjectId,
  state: IssueListState,
  /** Free text, matched by the host's own search. */
  query: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
  /** 1-based; each page holds `ISSUE_LIST_PAGE_SIZE` issues. */
  page: Schema.optional(PositiveInt),
});
export type IssueListInput = typeof IssueListInput.Type;

export const ISSUE_LIST_PAGE_SIZE = 50;

export const IssueSummary = Schema.Struct({
  number: PositiveInt,
  title: Schema.String,
  url: Schema.String,
  state: IssueState,
  stateReason: Schema.optional(Schema.NullOr(IssueStateReason)),
  author: Schema.NullOr(PullRequestActor),
  assignees: Schema.Array(PullRequestActor),
  labels: Schema.Array(PullRequestLabel),
  commentCount: NonNegativeInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  closedAt: Schema.NullOr(IsoDateTime),
});
export type IssueSummary = typeof IssueSummary.Type;

export const IssueListResult = Schema.Struct({
  /** `owner/name` of the repository the issues were read from. */
  repository: Schema.String,
  host: Schema.String,
  issues: Schema.Array(IssueSummary),
  hasMore: Schema.Boolean,
});
export type IssueListResult = typeof IssueListResult.Type;

export const IssueReadInput = Schema.Struct({
  projectId: ProjectId,
  number: PositiveInt,
});
export type IssueReadInput = typeof IssueReadInput.Type;

export const IssueComment = Schema.Struct({
  id: TrimmedNonEmptyString,
  author: Schema.NullOr(PullRequestActor),
  body: Schema.String,
  createdAt: IsoDateTime,
  editedAt: Schema.NullOr(IsoDateTime),
  url: Schema.NullOr(Schema.String),
});
export type IssueComment = typeof IssueComment.Type;

export const IssueDetail = Schema.Struct({
  ...IssueSummary.fields,
  repository: Schema.String,
  body: Schema.String,
  comments: Schema.Array(IssueComment),
  /** The issue has more comments than were read; the rest are on the host. */
  commentsTruncated: Schema.Boolean,
});
export type IssueDetail = typeof IssueDetail.Type;

export const IssueErrorReason = Schema.Literals([
  /** The project has no repository on a host whose issues this build can read. */
  "unsupported",
  /** No working credential for the host. */
  "unauthenticated",
  "not-found",
  "rate-limited",
  "failed",
]);
export type IssueErrorReason = typeof IssueErrorReason.Type;

export class IssueError extends Schema.TaggedError<IssueError>()(
  "IssueError",
  {
    reason: IssueErrorReason,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 502 },
) {
  [HttpServerRespondable.symbol]() {
    return HttpServerResponse.schemaJson(IssueError)(this, { status: 502 });
  }

  override get message(): string {
    return this.detail;
  }
}
