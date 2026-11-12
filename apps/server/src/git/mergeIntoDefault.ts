import { GitManagerError, type GitCommandError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";

import type * as GitVcsDriver from "../vcs/GitVcsDriver.ts";

type Git = GitVcsDriver.GitVcsDriver["Service"];

export interface MergeIntoDefaultResult {
  readonly status: "merged" | "already_merged";
  readonly baseBranch: string;
  readonly commitSha: string;
  readonly push:
    | { readonly status: "pushed" | "skipped_up_to_date"; readonly upstreamBranch: string }
    | undefined;
  /** The branch was rebased onto the default branch because that had moved. */
  readonly rebased: boolean;
  /** The rebase rewrote a branch that was fully pushed, so its upstream was replaced to match. */
  readonly branchUpstream?:
    | { readonly status: "pushed" | "failed"; readonly name: string }
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

/** The default branch's name: the remote's, else a local `main` or `master`; null when neither is known. */
export const resolveDefaultBranch = Effect.fn("GitManager.resolveDefaultBranch")(function* (
  git: Git,
  cwd: string,
) {
  const remote = yield* git.resolvePrimaryRemoteName(cwd).pipe(Effect.orElseSucceed(() => null));
  const originDefault = remote === null ? null : yield* git.resolveDefaultBranchName(cwd, remote);
  if (originDefault !== null) return originDefault;
  for (const candidate of ["main", "master"]) {
    const exists = yield* git.execute({
      operation: "GitManager.resolveDefaultBranch.probe",
      cwd,
      args: ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`],
      allowNonZeroExit: true,
    });
    if (exists.exitCode === 0) return candidate;
  }
  return null;
});

/**
 * Fast-forwards the default branch to `branch` (rebasing `branch` onto it first when it moved),
 * and optionally pushes the default branch. Runs in the default branch's own checkout, whose
 * uncommitted edits stay unless the merge changes the same files; the thread's checkout is `cwd`
 * and is never switched.
 */
const mergeIntoDefaultNow = Effect.fn("GitManager.mergeIntoDefault.run")(function* (
  git: Git,
  input: {
    readonly cwd: string;
    readonly branch: string;
    readonly push: boolean;
    /** Push the default branch as it is: no rebase, no fast-forward. */
    readonly pushOnly?: boolean;
    /** Rebase the branch onto the default branch if it moved, and stop there. */
    readonly rebaseOnly?: boolean;
    /** Runs after the rebase, with the default branch locked, and stops the merge by failing. */
    readonly beforeLand?: Effect.Effect<void, GitManagerError>;
    /**
     * Turns a branch of several commits into one before it lands; given the default branch's ref,
     * it writes the commit message. The branch is reset to the new commit, so its own history is gone.
     */
    readonly squashMessage?: (baseRef: string) => Effect.Effect<string, GitManagerError>;
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
  const base = yield* resolveDefaultBranch(git, cwd);
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

  const baseSha = () =>
    run("base-sha", cwd, ["rev-parse", `refs/heads/${base}`]).pipe(
      Effect.map((result) => result.stdout.trim()),
    );
  const baseInHead = () =>
    succeeds("base-in-head", ["merge-base", "--is-ancestor", `refs/heads/${base}`, "HEAD"]);
  // Fast-forwards the default branch; null when done, else why not and whether it moved meanwhile.
  const fastForward = Effect.fn("GitManager.mergeIntoDefault.fastForward")(function* () {
    const worktrees = yield* run("worktrees", cwd, ["worktree", "list", "--porcelain"]);
    const baseCheckout = checkoutPathOf(worktrees.stdout, base);
    // Not checked out anywhere, so no working tree can go stale; Git refuses a non-fast-forward.
    // Git itself refuses in a checkout only when the files it would change have local edits.
    const forwarded =
      baseCheckout === null
        ? yield* run("advance", cwd, ["fetch", ".", `refs/heads/${branch}:refs/heads/${base}`], {
            allowNonZeroExit: true,
          })
        : yield* run("fast-forward", baseCheckout, ["merge", "--ff-only", `refs/heads/${branch}`], {
            allowNonZeroExit: true,
          });
    if (forwarded.exitCode === 0) return null;
    const inTheWay = /would be overwritten/i.test(`${forwarded.stderr}${forwarded.stdout}`);
    return {
      moved: !inTheWay && !(yield* baseInHead()),
      message: inTheWay
        ? `${baseCheckout} has uncommitted changes or untracked files in the way of this merge. Commit or stash them there, then run the action again.`
        : `Could not fast-forward ${base}${baseCheckout === null ? "" : ` in ${baseCheckout}`}. Nothing was merged.`,
    };
  });

  // Replaces the branch's upstream with the rebased branch, only if nobody pushed to it meanwhile.
  const resyncUpstream = Effect.fn("GitManager.mergeIntoDefault.resyncUpstream")(function* (
    expected: string,
  ) {
    const head = (yield* run("head-sha-after", cwd, ["rev-parse", "HEAD"])).stdout.trim();
    if (head === expected) return undefined;
    const upstreamRemote = yield* git.readConfigValue(cwd, `branch.${branch}.remote`);
    const upstreamRef = yield* git.readConfigValue(cwd, `branch.${branch}.merge`);
    if (!upstreamRemote || upstreamRemote === "." || !upstreamRef) return undefined;
    const pushed = yield* run(
      "resync-upstream",
      cwd,
      [
        "push",
        `--force-with-lease=${upstreamRef}:${expected}`,
        "--",
        upstreamRemote,
        `HEAD:${upstreamRef}`,
      ],
      { allowNonZeroExit: true },
    );
    return {
      status: pushed.exitCode === 0 ? ("pushed" as const) : ("failed" as const),
      name: `${upstreamRemote}/${upstreamRef.replace(/^refs\/heads\//, "")}`,
    };
  });

  // A branch that was fully pushed would show as diverged from its upstream once the rebase
  // rewrites it, so the merge puts the upstream back in step (see `resyncUpstream`).
  const upstreamBefore = input.pushOnly
    ? null
    : yield* run(
        "upstream-sha",
        cwd,
        ["rev-parse", "--verify", "--quiet", `${branch}@{upstream}`],
        { allowNonZeroExit: true },
      ).pipe(Effect.map((result) => (result.exitCode === 0 ? result.stdout.trim() : null)));
  const headBefore = (yield* run("head-sha", cwd, ["rev-parse", "HEAD"])).stdout.trim();

  const squash = Effect.fn("GitManager.mergeIntoDefault.squash")(function* (
    message: (baseRef: string) => Effect.Effect<string, GitManagerError>,
  ) {
    const baseRef = `refs/heads/${base}`;
    const count = yield* run("count", cwd, ["rev-list", "--count", `${baseRef}..HEAD`]);
    if (Number(count.stdout.trim()) < 2) return;
    // The squashed commit has HEAD's tree, so the checkout and index stay as they are.
    const squashed = yield* run("squash-commit", cwd, [
      "commit-tree",
      "HEAD^{tree}",
      "-p",
      baseRef,
      "-m",
      yield* message(baseRef),
    ]);
    yield* run("squash-reset", cwd, ["reset", "--soft", squashed.stdout.trim()]);
  });

  // The rebase and the fast-forward are not one step: if the default branch moved in between
  // (a commit in its own checkout), rebase once more before giving up.
  let merged = input.pushOnly === true;
  let rebased = false;
  if (input.rebaseOnly) {
    const dirty = yield* run("dirty", cwd, ["status", "--porcelain", "--untracked-files=no"]);
    if (dirty.stdout.trim().length > 0) {
      return yield* fail(
        "This checkout has uncommitted changes. Commit or stash them, then run the action again.",
      );
    }
  }
  for (let attempt = 0; !merged; attempt++) {
    if (!(yield* baseInHead())) {
      const rebase = yield* run("rebase", cwd, ["rebase", `refs/heads/${base}`], {
        allowNonZeroExit: true,
      });
      if (rebase.exitCode !== 0) {
        yield* run("rebase-abort", cwd, ["rebase", "--abort"], { allowNonZeroExit: true });
        return yield* fail(
          `Rebasing ${branch} onto ${base} hit conflicts, so nothing was ${input.rebaseOnly ? "changed" : "merged"}. Resolve them with \`git rebase ${base}\` in this checkout, then run the action again.`,
        );
      }
      rebased = true;
    }
    if (input.rebaseOnly) break;
    merged = yield* succeeds("head-in-base", [
      "merge-base",
      "--is-ancestor",
      "HEAD",
      `refs/heads/${base}`,
    ]);
    if (merged) break;
    if (input.beforeLand !== undefined) yield* input.beforeLand;
    if (input.squashMessage !== undefined) yield* squash(input.squashMessage);
    const failure = yield* fastForward();
    if (failure === null) break;
    if (!failure.moved || attempt > 0) return yield* fail(failure.message);
  }

  const branchUpstream =
    upstreamBefore !== null && upstreamBefore === headBefore
      ? yield* resyncUpstream(upstreamBefore)
      : undefined;

  const commitSha = yield* baseSha();
  if (input.rebaseOnly) {
    return {
      status: "already_merged",
      baseBranch: base,
      commitSha,
      push: undefined,
      rebased,
      branchUpstream,
    };
  }
  // Marks the branch as merged for the status; the key is read in `GitVcsDriverCore`.
  if (!input.pushOnly) {
    yield* git.writeConfigValue({ cwd, key: `branch.${branch}.t3-merged-sha`, value: commitSha });
  }
  if (!input.push) {
    return {
      status: merged ? "already_merged" : "merged",
      baseBranch: base,
      commitSha,
      push: undefined,
      rebased,
      branchUpstream,
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
      rebased,
      branchUpstream,
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
    rebased,
    branchUpstream,
  };
});

const repositoryLocks = new Map<string, Semaphore.Semaphore>();

/**
 * Merges run one at a time per repository, so threads merging at once queue instead of racing
 * each other's rebase and fast-forward.
 */
export const mergeIntoDefault = Effect.fn("GitManager.mergeIntoDefault")(function* (
  ...args: Parameters<typeof mergeIntoDefaultNow>
) {
  const [git, input] = args;
  const common = yield* git.execute({
    operation: "GitManager.mergeIntoDefault.repository",
    cwd: input.cwd,
    args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  });
  const key = common.stdout.trim();
  const lock = repositoryLocks.get(key) ?? Semaphore.makeUnsafe(1);
  repositoryLocks.set(key, lock);
  return yield* mergeIntoDefaultNow(...args).pipe(lock.withPermits(1));
});
