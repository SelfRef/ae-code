import type {
  IssueComment,
  IssueDetail,
  IssueState,
  IssueStateReason,
  IssueSummary,
  PullRequestActor,
  PullRequestLabel,
} from "@t3tools/contracts";
import type { IssueProviderApi } from "@t3tools/source-control-core/server/IssueProvider";
import { PullRequestProviderError } from "@t3tools/source-control-core/server/PullRequestProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { definition } from "../shared/definition.ts";
import * as GitHubRest from "./GitHubRest.ts";
import type { GitHubApiError } from "./GitHubRequestPolicy.ts";

const User = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.optional(Schema.NullOr(Schema.String)),
  type: Schema.optional(Schema.String),
});

const Label = Schema.Union([
  Schema.String,
  Schema.Struct({
    name: Schema.optional(Schema.NullOr(Schema.String)),
    color: Schema.optional(Schema.NullOr(Schema.String)),
  }),
]);

const RestIssue = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  html_url: Schema.String,
  state: Schema.String,
  state_reason: Schema.optional(Schema.NullOr(Schema.String)),
  user: Schema.optional(Schema.NullOr(User)),
  assignees: Schema.optional(Schema.NullOr(Schema.Array(User))),
  labels: Schema.optional(Schema.NullOr(Schema.Array(Label))),
  comments: Schema.optional(Schema.Int),
  created_at: Schema.String,
  updated_at: Schema.String,
  closed_at: Schema.optional(Schema.NullOr(Schema.String)),
  body: Schema.optional(Schema.NullOr(Schema.String)),
  /** Present on a pull request, which GitHub's issue endpoints list alongside issues. */
  pull_request: Schema.optional(Schema.Unknown),
});
type RestIssue = typeof RestIssue.Type;

const RestComment = Schema.Struct({
  id: Schema.Int,
  html_url: Schema.optional(Schema.NullOr(Schema.String)),
  user: Schema.optional(Schema.NullOr(User)),
  body: Schema.optional(Schema.NullOr(Schema.String)),
  created_at: Schema.String,
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
});

const decodeSearch = Schema.decodeUnknownResult(
  Schema.fromJsonString(
    Schema.Struct({
      total_count: Schema.Int,
      items: Schema.Array(RestIssue),
    }),
  ),
);
const decodeIssue = Schema.decodeUnknownResult(Schema.fromJsonString(RestIssue));
const decodeComments = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Array(RestComment)));

/** One page holds this many comments; an issue with more shows the first ones. */
const COMMENT_PAGE_SIZE = 100;

const PROVIDER = definition.kind;

function actorOf(user: typeof User.Type | null | undefined): PullRequestActor | null {
  if (user === null || user === undefined) return null;
  return {
    login: user.login,
    name: null,
    avatarUrl: user.avatar_url ?? null,
    ...(user.type === "Bot" ? { isBot: true } : {}),
  };
}

function labelOf(label: typeof Label.Type): PullRequestLabel | null {
  if (typeof label === "string") return label.length > 0 ? { name: label, color: null } : null;
  return label.name ? { name: label.name, color: label.color ?? null } : null;
}

function stateReasonOf(reason: string | null | undefined): IssueStateReason | null {
  switch (reason) {
    case "completed":
      return "completed";
    case "not_planned":
      return "not-planned";
    case "reopened":
      return "reopened";
    default:
      return null;
  }
}

function summaryOf(issue: RestIssue): IssueSummary {
  const state: IssueState = issue.state === "closed" ? "closed" : "open";
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state,
    stateReason: stateReasonOf(issue.state_reason),
    author: actorOf(issue.user),
    assignees: (issue.assignees ?? []).flatMap((user) => actorOf(user) ?? []),
    labels: (issue.labels ?? []).flatMap((label) => labelOf(label) ?? []),
    commentCount: issue.comments ?? 0,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at ?? null,
  };
}

function failure(
  operation: string,
  reason: PullRequestProviderError["reason"],
  detail: string,
  extra: { readonly retryAt?: number; readonly cause?: unknown } = {},
) {
  return new PullRequestProviderError({
    provider: PROVIDER,
    operation,
    reason,
    detail,
    ...(extra.retryAt === undefined ? {} : { retryAt: extra.retryAt }),
    ...(extra.cause === undefined ? {} : { cause: extra.cause }),
  });
}

function providerError(operation: string, error: GitHubApiError): PullRequestProviderError {
  switch (error._tag) {
    case "GitHubCliMissingError":
      return failure(operation, "missing-tool", error.message, { cause: error });
    case "GitHubNotSignedInError":
    case "GitHubHostDisabledError":
    case "SettingsSecretUnresolvedError":
    case "GitHubApiAuthenticationError":
      return failure(operation, "unauthenticated", error.message, { cause: error });
    case "GitHubApiRateLimitError":
      return failure(operation, "rate-limited", error.message, {
        cause: error,
        ...(error.retryAt === undefined ? {} : { retryAt: error.retryAt }),
      });
    case "SourceControlRateLimitPausedError":
      return failure(operation, "rate-limited", error.message, {
        cause: error,
        retryAt: error.retryAt,
      });
    case "GitHubApiNotFoundError":
      return failure(operation, "not-found", error.message, { cause: error });
    case "GitHubApiResponseError":
      return failure(operation, error.status === 403 ? "forbidden" : "failed", error.message, {
        cause: error,
      });
    default:
      return failure(operation, "failed", error.message, { cause: error });
  }
}

function repositoryPath(operation: string, repository: string) {
  const segments = repository.split("/");
  return segments.length === 2 && segments.every((segment) => !["", ".", ".."].includes(segment))
    ? Effect.succeed(segments.map(encodeURIComponent).join("/"))
    : Effect.fail(failure(operation, "failed", `"${repository}" is not an owner/name repository.`));
}

export const make = Effect.gen(function* () {
  const api = yield* GitHubRest.GitHubRest;

  const read = <A>(input: {
    readonly host: string;
    readonly operation: string;
    readonly path: string;
    readonly decode: (raw: string) => Result.Result<A, unknown>;
  }) =>
    api.rest({ host: input.host, operation: input.operation, path: input.path }).pipe(
      Effect.mapError((error) => providerError(input.operation, error)),
      Effect.flatMap((response) => {
        const decoded = input.decode(response.body);
        return Result.isSuccess(decoded)
          ? Effect.succeed(decoded.success)
          : Effect.fail(
              failure(
                input.operation,
                "failed",
                "GitHub answered with something this build cannot read.",
                { cause: decoded.failure },
              ),
            );
      }),
    );

  const listIssues: IssueProviderApi["listIssues"] = Effect.fn("GitHubIssueProvider.listIssues")(
    function* (input) {
      yield* repositoryPath("listIssues", input.repository);
      const stateQualifier = input.state === "all" ? "" : ` is:${input.state}`;
      const query = `repo:${input.repository} is:issue${stateQualifier}${input.query === undefined ? "" : ` ${input.query.trim()}`}`;
      const answer = yield* read({
        host: input.host,
        operation: "listIssues",
        path: `search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${input.pageSize}&page=${input.page}`,
        decode: decodeSearch,
      });
      return {
        issues: answer.items.filter((item) => item.pull_request === undefined).map(summaryOf),
        hasMore: input.page * input.pageSize < Math.min(answer.total_count, 1000),
      };
    },
  );

  const getIssue: IssueProviderApi["getIssue"] = Effect.fn("GitHubIssueProvider.getIssue")(
    function* (input) {
      const path = yield* repositoryPath("getIssue", input.repository);
      const [issue, comments] = yield* Effect.all(
        [
          read({
            host: input.host,
            operation: "getIssue",
            path: `repos/${path}/issues/${input.number}`,
            decode: decodeIssue,
          }),
          read({
            host: input.host,
            operation: "getIssueComments",
            path: `repos/${path}/issues/${input.number}/comments?per_page=${COMMENT_PAGE_SIZE}`,
            decode: decodeComments,
          }),
        ],
        { concurrency: 2 },
      );
      if (issue.pull_request !== undefined) {
        return yield* failure(
          "getIssue",
          "not-found",
          `#${input.number} is a pull request, not an issue.`,
        );
      }
      const summary = summaryOf(issue);
      return {
        ...summary,
        repository: input.repository,
        body: issue.body ?? "",
        comments: comments.map((comment): IssueComment => ({
          id: String(comment.id),
          author: actorOf(comment.user),
          body: comment.body ?? "",
          createdAt: comment.created_at,
          editedAt:
            comment.updated_at != null && comment.updated_at !== comment.created_at
              ? comment.updated_at
              : null,
          url: comment.html_url ?? null,
        })),
        commentsTruncated: summary.commentCount > comments.length,
      } satisfies IssueDetail;
    },
  );

  return { kind: definition.kind, listIssues, getIssue } satisfies IssueProviderApi;
});
