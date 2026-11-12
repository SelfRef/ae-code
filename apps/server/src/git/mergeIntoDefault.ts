import { GitManagerError, type GitCommandError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type * as GitVcsDriver from "../vcs/GitVcsDriver.ts";

type Git = GitVcsDriver.GitVcsDriver["Service"];

export interface MergeIntoDefaultResult {
  readonly status: "merged" | "already_merged";
  readonly baseBranch: string;
  readonly commitSha: string;
  readonly push:
    | { readonly status: "pushed" | "skipped_up_to_date"; readonly upstreamBranch: string }
    | undefined;
}

/** Path of the worktree that has `refs/heads/<branch>` checked out, if any. */
function checkoutPathOf(porcelain: string, branch: string): string | null {
  for (const block of porcelain.split("\n\n")) {
    const lines = block.split("\n");
    if (!lines.includes(`branch refs/heads/${branch}`)) continue;
    const path = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    if (path) return path;
  }
  return null;
}

/**
 * Fast-forwards the default branch to `branch` (rebasing `branch` onto it first when it moved),
 * and optionally pushes the default branch. Runs in the default branch's own checkout, whose
 * uncommitted edits stay unless the merge changes the same files; the thread's checkout is `cwd`
 * and is never switched.
 */
export const mergeIntoDefault = Effect.fn("GitManager.mergeIntoDefault")(function* (
  git: Git,
  input: {
    readonly cwd: string;
    readonly branch: string;
    readonly push: boolean;
    /** Push the default branch as it is: no rebase, no fast-forward. */
    readonly pushOnly?: boolean;
  },
): Effect.fn.Return<MergeIntoDefaultResult, GitManagerError | GitCommandError> {
  const { cwd, branch } = input;
  const fail = (detail: string) =>
    new GitManagerError({ operation: "runStackedAction", cwd, detail });
  const run = (
    operation: string,
    runCwd: string,
    args: ReadonlyArray<string>,
    options?: { readonly allowNonZeroExit: boolean },
  ) =>
    git.execute({
      operation: `GitManager.mergeIntoDefault.${operation}`,
      cwd: runCwd,
      args,
      timeoutMs: 120_000,
      ...options,
    });
  const succeeds = (operation: string, args: ReadonlyArray<string>) =>
    run(operation, cwd, args, { allowNonZeroExit: true }).pipe(
      Effect.map((result) => result.exitCode === 0),
    );

  const remote = yield* git.resolvePrimaryRemoteName(cwd).pipe(Effect.orElseSucceed(() => null));
  const originDefault = remote === null ? null : yield* git.resolveDefaultBranchName(cwd, remote);
  let base = originDefault;
  if (base === null) {
    for (const candidate of ["main", "master"]) {
      if (
        yield* succeeds("probe", ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`])
      ) {
        base = candidate;
        break;
      }
    }
  }
  if (base === null) return yield* fail("Could not tell which branch is the default branch.");
  if (base === branch && !input.pushOnly)
    return yield* fail(`${branch} is the default branch; there is nothing to merge.`);
  if (
    !(yield* succeeds("base-exists", ["show-ref", "--verify", "--quiet", `refs/heads/${base}`]))
  ) {
    return yield* fail(
      `The default branch ${base} does not exist in this repository. Create it locally first.`,
    );
  }

  if (
    !input.pushOnly &&
    !(yield* succeeds("base-in-head", [
      "merge-base",
      "--is-ancestor",
      `refs/heads/${base}`,
      "HEAD",
    ]))
  ) {
    const rebased = yield* run("rebase", cwd, ["rebase", `refs/heads/${base}`], {
      allowNonZeroExit: true,
    });
    if (rebased.exitCode !== 0) {
      yield* run("rebase-abort", cwd, ["rebase", "--abort"], { allowNonZeroExit: true });
      return yield* fail(
        `Rebasing ${branch} onto ${base} hit conflicts, so nothing was merged. Resolve them with \`git rebase ${base}\` in this checkout, then run the action again.`,
      );
    }
  }

  const baseSha = () =>
    run("base-sha", cwd, ["rev-parse", `refs/heads/${base}`]).pipe(
      Effect.map((result) => result.stdout.trim()),
    );
  const merged =
    input.pushOnly ||
    (yield* succeeds("head-in-base", [
      "merge-base",
      "--is-ancestor",
      "HEAD",
      `refs/heads/${base}`,
    ]));
  if (!merged) {
    const worktrees = yield* run("worktrees", cwd, ["worktree", "list", "--porcelain"]);
    const baseCheckout = checkoutPathOf(worktrees.stdout, base);
    if (baseCheckout === null) {
      // Not checked out anywhere, so no working tree can go stale; Git refuses a non-fast-forward.
      yield* run("advance", cwd, ["fetch", ".", `refs/heads/${branch}:refs/heads/${base}`]);
    } else {
      // Git itself refuses only when the files it would change have local edits, so other edits stay.
      const forwarded = yield* run(
        "fast-forward",
        baseCheckout,
        ["merge", "--ff-only", `refs/heads/${branch}`],
        { allowNonZeroExit: true },
      );
      if (forwarded.exitCode !== 0) {
        return yield* fail(
          /would be overwritten/i.test(`${forwarded.stderr}${forwarded.stdout}`)
            ? `${baseCheckout} has uncommitted changes or untracked files in the way of this merge. Commit or stash them there, then run the action again.`
            : `Could not fast-forward ${base} in ${baseCheckout}. Nothing was merged.`,
        );
      }
    }
  }

  const commitSha = yield* baseSha();
  if (!input.push) {
    return {
      status: merged ? "already_merged" : "merged",
      baseBranch: base,
      commitSha,
      push: undefined,
    };
  }

  const configured = {
    remote: yield* git.readConfigValue(cwd, `branch.${base}.remote`),
    merge: yield* git.readConfigValue(cwd, `branch.${base}.merge`),
  };
  const pushRemote = configured.remote ?? remote;
  if (pushRemote === null) return yield* fail("This repository has no remote to push to.");
  const remoteBranch = configured.merge?.replace(/^refs\/heads\//, "") ?? base;
  const upstreamBranch = `${pushRemote}/${remoteBranch}`;
  const remoteSha = yield* run(
    "remote-sha",
    cwd,
    ["rev-parse", "--verify", "--quiet", `refs/remotes/${upstreamBranch}`],
    { allowNonZeroExit: true },
  );
  if (remoteSha.exitCode === 0 && remoteSha.stdout.trim() === commitSha) {
    return {
      status: merged ? "already_merged" : "merged",
      baseBranch: base,
      commitSha,
      push: { status: "skipped_up_to_date", upstreamBranch },
    };
  }
  // A failed push throws git's classified error, which keeps credentials out of the message.
  yield* run("push", cwd, [
    "push",
    "--",
    pushRemote,
    `refs/heads/${base}:refs/heads/${remoteBranch}`,
  ]);
  return {
    status: merged ? "already_merged" : "merged",
    baseBranch: base,
    commitSha,
    push: { status: "pushed", upstreamBranch },
  };
});
