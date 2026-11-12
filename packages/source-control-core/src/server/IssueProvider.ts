import type * as Effect from "effect/Effect";
import type {
  IssueDetail,
  IssueListSort,
  IssueListState,
  IssueSummary,
  IssueState,
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

/** Reads of a host's issues and releases, and the changes an agent makes to an issue. */
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
  readonly createIssue: (input: {
    readonly host: string;
    readonly repository: string;
    readonly title: string;
    readonly body?: string | undefined;
    readonly labels?: ReadonlyArray<string> | undefined;
    readonly assignees?: ReadonlyArray<string> | undefined;
  }) => Effect.Effect<IssueSummary, PullRequestProviderError>;
  /** Fields left out stay as they are; `labels` and `assignees` replace the whole set. */
  readonly updateIssue: (input: {
    readonly host: string;
    readonly repository: string;
    readonly number: number;
    readonly title?: string | undefined;
    readonly body?: string | undefined;
    readonly state?: IssueState | undefined;
    readonly stateReason?: "completed" | "not-planned" | undefined;
    readonly labels?: ReadonlyArray<string> | undefined;
    readonly assignees?: ReadonlyArray<string> | undefined;
  }) => Effect.Effect<IssueSummary, PullRequestProviderError>;
  readonly commentOnIssue: (input: {
    readonly host: string;
    readonly repository: string;
    readonly number: number;
    readonly body: string;
  }) => Effect.Effect<void, PullRequestProviderError>;
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
