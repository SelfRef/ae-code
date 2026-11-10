import type * as Effect from "effect/Effect";
import type {
  IssueDetail,
  IssueListSort,
  IssueListState,
  IssueSummary,
  ReleaseDetail,
  ReleaseSummary,
  SourceControlProviderKind,
} from "@t3tools/contracts";

import type { PullRequestProviderError } from "./PullRequestProvider.ts";

export interface IssueProviderPage {
  readonly issues: ReadonlyArray<IssueSummary>;
  readonly hasMore: boolean;
}

export interface ReleaseProviderPage {
  readonly releases: ReadonlyArray<ReleaseSummary>;
  readonly hasMore: boolean;
}

/** Reads of a host's issues and releases; hosts without one have no Issues or Releases view. */
export interface IssueProviderApi {
  readonly kind: SourceControlProviderKind;
  readonly listIssues: (input: {
    readonly host: string;
    readonly repository: string;
    readonly state: IssueListState;
    readonly sort?: IssueListSort | undefined;
    readonly query?: string | undefined;
    readonly page: number;
    readonly pageSize: number;
  }) => Effect.Effect<IssueProviderPage, PullRequestProviderError>;
  readonly getIssue: (input: {
    readonly host: string;
    readonly repository: string;
    readonly number: number;
  }) => Effect.Effect<IssueDetail, PullRequestProviderError>;
  readonly listReleases: (input: {
    readonly host: string;
    readonly repository: string;
    readonly page: number;
    readonly pageSize: number;
  }) => Effect.Effect<ReleaseProviderPage, PullRequestProviderError>;
  readonly getRelease: (input: {
    readonly host: string;
    readonly repository: string;
    readonly id: number;
  }) => Effect.Effect<ReleaseDetail, PullRequestProviderError>;
}
