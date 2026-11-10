import type * as Effect from "effect/Effect";
import type {
  IssueDetail,
  IssueListState,
  IssueSummary,
  SourceControlProviderKind,
} from "@t3tools/contracts";

import type { PullRequestProviderError } from "./PullRequestProvider.ts";

export interface IssueProviderPage {
  readonly issues: ReadonlyArray<IssueSummary>;
  readonly hasMore: boolean;
}

/** Reads of a host's issues; hosts without one have no Issues view. */
export interface IssueProviderApi {
  readonly kind: SourceControlProviderKind;
  readonly listIssues: (input: {
    readonly host: string;
    readonly repository: string;
    readonly state: IssueListState;
    readonly query?: string | undefined;
    readonly page: number;
    readonly pageSize: number;
  }) => Effect.Effect<IssueProviderPage, PullRequestProviderError>;
  readonly getIssue: (input: {
    readonly host: string;
    readonly repository: string;
    readonly number: number;
  }) => Effect.Effect<IssueDetail, PullRequestProviderError>;
}
