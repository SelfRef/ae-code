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

export const IssueListSort = Schema.Literals(["updated", "newest", "oldest", "comments"]);
export type IssueListSort = typeof IssueListSort.Type;

export const IssueListInput = Schema.Struct({
  projectId: ProjectId,
  state: IssueListState,
  /** Defaults to `updated`: recently updated first. */
  sort: Schema.optional(IssueListSort),
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

const IssueText = Schema.String.check(Schema.isMaxLength(65_536));
const IssueNames = Schema.Array(TrimmedNonEmptyString).check(Schema.isMaxLength(25));

export const IssueCreateInput = Schema.Struct({
  projectId: ProjectId,
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  body: Schema.optional(IssueText),
  labels: Schema.optional(IssueNames),
  assignees: Schema.optional(IssueNames),
});
export type IssueCreateInput = typeof IssueCreateInput.Type;

/** Every field but `projectId` and `number` is optional; an omitted one stays as it is. */
export const IssueUpdateInput = Schema.Struct({
  projectId: ProjectId,
  number: PositiveInt,
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(256))),
  body: Schema.optional(IssueText),
  state: Schema.optional(IssueState),
  /** Why a closed issue closed; only sent with `state: "closed"`. */
  stateReason: Schema.optional(Schema.Literals(["completed", "not-planned"])),
  /** The whole set: it replaces the issue's labels. */
  labels: Schema.optional(IssueNames),
  /** The whole set: it replaces the issue's assignees. */
  assignees: Schema.optional(IssueNames),
  /** Posted after the other changes, so a refused change leaves no comment. */
  comment: Schema.optional(IssueText.check(Schema.isNonEmpty())),
});
export type IssueUpdateInput = typeof IssueUpdateInput.Type;

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
