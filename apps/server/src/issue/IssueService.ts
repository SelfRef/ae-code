import {
  IssueError,
  ISSUE_LIST_PAGE_SIZE,
  type IssueDetail,
  type IssueListInput,
  type IssueListResult,
  type IssueReadInput,
  type ProjectId,
} from "@t3tools/contracts";
import type { PullRequestProviderError } from "@t3tools/source-control-core/server/PullRequestProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ProjectService from "../project/ProjectService.ts";
import * as RepositoryIdentityResolver from "../project/RepositoryIdentityResolver.ts";
import { sourceControlDefinitions } from "../sourceControl/sourceControlDefinitions.ts";
import * as IssueProviderRegistry from "./IssueProviderRegistry.ts";

export class IssueService extends Context.Service<
  IssueService,
  {
    readonly list: (input: IssueListInput) => Effect.Effect<IssueListResult, IssueError>;
    readonly read: (input: IssueReadInput) => Effect.Effect<IssueDetail, IssueError>;
  }
>()("t3/issue/IssueService") {}

function toIssueError(error: PullRequestProviderError): IssueError {
  switch (error.reason) {
    case "missing-tool":
    case "unauthenticated":
      return new IssueError({
        reason: "unauthenticated",
        detail:
          "GitHub has no working credential. Run `gh auth login` or save a token in Settings.",
        cause: error,
      });
    case "rate-limited":
      return new IssueError({ reason: "rate-limited", detail: error.detail, cause: error });
    case "not-found":
      return new IssueError({ reason: "not-found", detail: error.detail, cause: error });
    default:
      return new IssueError({ reason: "failed", detail: error.detail, cause: error });
  }
}

const make = Effect.gen(function* () {
  const projects = yield* ProjectService.ProjectService;
  const identities = yield* RepositoryIdentityResolver.RepositoryIdentityResolver;
  const registry = yield* IssueProviderRegistry.IssueProviderRegistry;

  const resolve = Effect.fn("IssueService.resolve")(function* (projectId: ProjectId) {
    const shell = yield* projects
      .getShell(projectId)
      .pipe(
        Effect.mapError(
          (cause) =>
            new IssueError({ reason: "failed", detail: "The project could not be read.", cause }),
        ),
      );
    if (Option.isNone(shell)) {
      return yield* new IssueError({ reason: "not-found", detail: "The project does not exist." });
    }
    const identity =
      shell.value.repositoryIdentity ?? (yield* identities.resolve(shell.value.workspaceRoot));
    const kind = identity?.provider;
    const repository = identity ? sourceControlDefinitions.repositorySelector(identity) : null;
    const api = kind === undefined ? null : registry.get(kind);
    if (identity === null || kind === undefined || repository === null || api === null) {
      return yield* new IssueError({
        reason: "unsupported",
        detail: "Issues are shown for projects whose repository is on GitHub.",
      });
    }
    return { api, repository, host: sourceControlDefinitions.changeRequestHost(identity, kind) };
  });

  return IssueService.of({
    list: Effect.fn("IssueService.list")(function* (input) {
      const { api, repository, host } = yield* resolve(input.projectId);
      const page = yield* api
        .listIssues({
          host,
          repository,
          state: input.state,
          query: input.query,
          page: input.page ?? 1,
          pageSize: ISSUE_LIST_PAGE_SIZE,
        })
        .pipe(Effect.mapError(toIssueError));
      return { repository, host, ...page };
    }),
    read: Effect.fn("IssueService.read")(function* (input) {
      const { api, repository, host } = yield* resolve(input.projectId);
      return yield* api
        .getIssue({ host, repository, number: input.number })
        .pipe(Effect.mapError(toIssueError));
    }),
  });
});

export const layer = Layer.effect(IssueService, make);
