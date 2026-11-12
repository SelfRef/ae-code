import type { GitCommandError, VcsDeleteMergedBranchesResult } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import { resolveDefaultBranch } from "./mergeIntoDefault.ts";

type Git = GitVcsDriver.GitVcsDriver["Service"];

/**
 * Deletes the local branches named that the default branch already contains, and says why it
 * kept the others. Never touches the default branch or a branch checked out anywhere, nor one with
 * commits the default branch lacks unless `force` is set.
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
  const checkedOut = new Set(
    worktrees.stdout
      .split("\n")
      .filter((line) => line.startsWith("branch refs/heads/"))
      .map((line) => line.slice("branch refs/heads/".length)),
  );
  for (const name of new Set(input.refNames)) {
    const skip = (reason: string) => skipped.push({ name, reason });
    if (name === base) {
      skip("It is the default branch.");
    } else if (checkedOut.has(name)) {
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
    } else {
      // Checked above, but `git branch -d` compares with the current HEAD, not the default branch.
      yield* git.deleteLocalBranch({ cwd, refName: name, force: true });
      deleted.push(name);
    }
  }
  return { deleted, skipped };
});
