import * as Schema from "effect/Schema";

import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** Moves an idle thread that works in the project checkout into a new worktree on a temporary branch. */
export const ThreadMoveToWorktreeInput = Schema.Struct({ threadId: ThreadId });
export type ThreadMoveToWorktreeInput = typeof ThreadMoveToWorktreeInput.Type;

export const ThreadMoveToWorktreeResult = Schema.Struct({
  worktreePath: TrimmedNonEmptyString,
  branch: TrimmedNonEmptyString,
});
export type ThreadMoveToWorktreeResult = typeof ThreadMoveToWorktreeResult.Type;
