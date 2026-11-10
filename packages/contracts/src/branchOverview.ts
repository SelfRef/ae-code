import * as Schema from "effect/Schema";

import { IsoDateTime, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const VcsBranchOverviewInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  /** Fetch the primary remote first (at most as often as the Git status poll does), so counts follow the remote and not an old fetch. */
  fetch: Schema.optional(Schema.Boolean),
});
export type VcsBranchOverviewInput = typeof VcsBranchOverviewInput.Type;

export const VcsBranchOverviewEntry = Schema.Struct({
  /** A local branch name, or `remote/name` for a branch that exists only on a remote. */
  name: TrimmedNonEmptyString,
  isRemoteOnly: Schema.Boolean,
  isDefault: Schema.Boolean,
  /** Checked out in the main checkout or a worktree of the one this call named. */
  current: Schema.Boolean,
  /** Where the branch is checked out in a linked worktree; null for a plain branch. */
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  /** The branch's upstream, for example `origin/feature`; null when it has none. */
  upstream: Schema.NullOr(TrimmedNonEmptyString),
  upstreamGone: Schema.Boolean,
  /** Commits the upstream lacks: what a push sends. */
  ahead: NonNegativeInt,
  /** Commits the upstream has that the branch lacks: what a pull brings. */
  behind: NonNegativeInt,
  /** Commits not yet in the default branch. 0 for the default branch itself. */
  aheadOfDefault: NonNegativeInt,
  behindDefault: NonNegativeInt,
  lastCommitAt: Schema.NullOr(IsoDateTime),
  lastCommitSubject: Schema.String,
});
export type VcsBranchOverviewEntry = typeof VcsBranchOverviewEntry.Type;

export const VcsBranchOverviewResult = Schema.Struct({
  isRepo: Schema.Boolean,
  /** The branch the others are compared with: the local default branch when it exists, else its `origin/` ref. */
  defaultRef: Schema.NullOr(TrimmedNonEmptyString),
  /** The default branch first, then the rest by latest commit. */
  branches: Schema.Array(VcsBranchOverviewEntry),
  /** True when more branches exist than `branches` holds. */
  truncated: Schema.Boolean,
});
export type VcsBranchOverviewResult = typeof VcsBranchOverviewResult.Type;
