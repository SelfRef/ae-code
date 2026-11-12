import * as Schema from "effect/Schema";

import { IsoDateTime, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** `VcsCommitLogInput.ref` value for every local and remote branch; no valid ref name holds a `*`. */
export const ALL_VCS_REFS = "*";

export const VCS_COMMIT_LOG_PAGE_SIZE = 100;
export const VCS_COMMIT_LOG_MAX_LIMIT = 1000;

export const VcsCommitLogInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  /** A branch as the branch list names it (`main`, `origin/feature`) or `ALL_VCS_REFS`. Unset is the checked-out HEAD. */
  ref: Schema.optional(TrimmedNonEmptyString),
  /** How many of the newest commits to return; a list that wants more asks again with a larger limit. */
  limit: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: VCS_COMMIT_LOG_MAX_LIMIT })),
  ),
});
export type VcsCommitLogInput = typeof VcsCommitLogInput.Type;

export const VcsCommitLogEntry = Schema.Struct({
  sha: TrimmedNonEmptyString,
  /** First parent first; two or more for a merge, none for a root commit. */
  parents: Schema.Array(TrimmedNonEmptyString),
  authorName: Schema.String,
  authoredAt: IsoDateTime,
  subject: Schema.String,
  /** Branches and tags pointing at the commit, as `git log --decorate` names them (`main`, `origin/main`, `tag: v1`). */
  refs: Schema.Array(Schema.String),
});
export type VcsCommitLogEntry = typeof VcsCommitLogEntry.Type;

export const VcsCommitLogResult = Schema.Struct({
  isRepo: Schema.Boolean,
  /** The ref the list follows; null for every branch, or when HEAD was listed. */
  ref: Schema.NullOr(TrimmedNonEmptyString),
  /** The branch checked out in `cwd`; null on a detached HEAD. */
  currentBranch: Schema.NullOr(TrimmedNonEmptyString),
  /** Newest first, in topological order so a graph can draw it. */
  commits: Schema.Array(VcsCommitLogEntry),
  hasMore: Schema.Boolean,
});
export type VcsCommitLogResult = typeof VcsCommitLogResult.Type;

export const VcsCommitDetailInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  sha: TrimmedNonEmptyString.check(Schema.isPattern(/^[0-9a-f]{7,64}$/i)),
});
export type VcsCommitDetailInput = typeof VcsCommitDetailInput.Type;

export const VcsCommitDetailFile = Schema.Struct({
  path: TrimmedNonEmptyString,
  /** Where a renamed file came from. */
  previousPath: Schema.NullOr(TrimmedNonEmptyString),
  /** Null for a binary file. */
  additions: Schema.NullOr(NonNegativeInt),
  deletions: Schema.NullOr(NonNegativeInt),
});
export type VcsCommitDetailFile = typeof VcsCommitDetailFile.Type;

export const VcsCommitDetailResult = Schema.Struct({
  sha: TrimmedNonEmptyString,
  /** The message after its subject line. */
  body: Schema.String,
  /** What the commit changed; for a merge, against its first parent. */
  files: Schema.Array(VcsCommitDetailFile),
  truncated: Schema.Boolean,
});
export type VcsCommitDetailResult = typeof VcsCommitDetailResult.Type;
