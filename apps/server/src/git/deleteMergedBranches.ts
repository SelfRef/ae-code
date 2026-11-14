import type { GitCommandError, VcsDeleteMergedBranchesResult } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import { resolveDefaultBranch } from "./mergeIntoDefault.ts";

type Git = GitVcsDriver.GitVcsDriver["Service"];

/**
 * Deletes the named local branches the default branch contains (any, with `force`), and says why
 * it kept the others. Never the default branch or the one checked out in the project root. A
 * linked worktree goes first; git refuses one with uncommitted changes unless `force` is set.
 */
export const deleteMergedBranches = Effect.fn("GitManager.deleteMergedBranches")(function* (
  git: Git,
  input: {
    readonly cwd: string;
    readonly refNames: ReadonlyArray<string>;
    readonly force?: boolean | undefined;
  },
): Effect.fn.Return<VcsDeleteMergedBranchesResult, GitCommandError> {
  const { cwd } = input;
  const run = (args: ReadonlyArray<string>) =>
    git.execute({
      operation: "GitManager.deleteMergedBranches",
      cwd,
      args,
      allowNonZeroExit: true,
    });
  const deleted: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const base = yield* resolveDefaultBranch(git, cwd);
  if (base === null) {
    return {
      deleted,
      skipped: input.refNames.map((name) => ({
        name,
        reason: "The default branch could not be found.",
      })),
    };
  }
  const worktrees = yield* run(["worktree", "list", "--porcelain"]);
  // The first entry is the main checkout; the rest are linked worktrees.
  const entries = worktrees.stdout.split("\n\n").map((block) => {
    const lines = block.split("\n");
    return {
      path: lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length),
      branch: lines
        .find((line) => line.startsWith("branch refs/heads/"))
        ?.slice("branch refs/heads/".length),
    };
  });
  const linked = new Map(
    entries.flatMap((entry, index) =>
      index > 0 && entry.branch !== undefined && entry.path !== undefined && entry.path !== cwd
        ? [[entry.branch, entry.path] as const]
        : [],
    ),
  );
  const checkedOut = new Set(
    entries.flatMap((entry) => (entry.branch === undefined ? [] : [entry.branch])),
  );
  for (const name of new Set(input.refNames)) {
    const skip = (reason: string) => skipped.push({ name, reason });
    const worktreePath = linked.get(name);
    if (name === base) {
      skip("It is the default branch.");
    } else if (checkedOut.has(name) && worktreePath === undefined) {
      skip("It is checked out.");
    } else if (
      (yield* run(["show-ref", "--verify", "--quiet", `refs/heads/${name}`])).exitCode !== 0
    ) {
      skip("It does not exist.");
    } else if (
      input.force !== true &&
      (yield* run(["merge-base", "--is-ancestor", `refs/heads/${name}`, `refs/heads/${base}`]))
        .exitCode !== 0
    ) {
      skip(`It has commits ${base} lacks.`);
    } else if (
      worktreePath !== undefined &&
      (yield* git.removeWorktree({ cwd, path: worktreePath, force: input.force === true }).pipe(
        Effect.as(false),
        Effect.orElseSucceed(() => true),
      ))
    ) {
      skip("Its worktree could not be removed, it may hold uncommitted changes.");
    } else {
      // Checked above, but `git branch -d` compares with the current HEAD, not the default branch.
      yield* git.deleteLocalBranch({ cwd, refName: name, force: true });
      deleted.push(name);
    }
  }
  return { deleted, skipped };
});
