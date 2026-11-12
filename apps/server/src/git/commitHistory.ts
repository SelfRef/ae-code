import {
  ALL_VCS_REFS,
  GitCommandError,
  VCS_COMMIT_LOG_PAGE_SIZE,
  type VcsCommitDetailFile,
  type VcsCommitDetailInput,
  type VcsCommitDetailResult,
  type VcsCommitLogEntry,
  type VcsCommitLogInput,
  type VcsCommitLogResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type * as GitVcsDriver from "../vcs/GitVcsDriver.ts";

type Git = GitVcsDriver.GitVcsDriver["Service"];

const COMMIT_DETAIL_FILE_LIMIT = 300;
const RECORD = "\u001e";
const FIELD = "\u001f";
/** One record per commit; the subject goes last because it is the only free text that may hold anything. */
const COMMIT_LOG_FORMAT = `--format=${RECORD}%H${FIELD}%P${FIELD}%an${FIELD}%aI${FIELD}%D${FIELD}%s`;

/** `HEAD -> main, origin/main, tag: v1` as the plain names, without the remote HEADs and the stash. */
function parseDecorations(decorations: string): string[] {
  return decorations
    .split(", ")
    .map((name) => name.replace(/^HEAD -> /, "").trim())
    .filter((name) => name !== "" && name !== "refs/stash" && !name.endsWith("/HEAD"));
}

export function parseCommitLog(stdout: string): VcsCommitLogEntry[] {
  const commits: VcsCommitLogEntry[] = [];
  for (const record of stdout.split(RECORD)) {
    const [sha, parents, authorName, authoredAt, decorations, ...subject] = record.split(FIELD);
    if (!sha?.trim()) continue;
    commits.push({
      sha: sha.trim(),
      parents: (parents ?? "").split(" ").filter(Boolean),
      authorName: authorName ?? "",
      authoredAt: authoredAt ?? "",
      subject: subject.join(FIELD).trim(),
      refs: parseDecorations(decorations ?? ""),
    });
  }
  return commits;
}

/** `git show --numstat -z`: `add<TAB>del<TAB>path`, or `add<TAB>del<TAB>` and then the old and the new path for a rename. */
export function parseNumstat(stdout: string): VcsCommitDetailFile[] {
  const files: VcsCommitDetailFile[] = [];
  const tokens = stdout.split("\0");
  for (let index = 0; index < tokens.length; index++) {
    const match = /^\n?(\d+|-)\t(\d+|-)\t(.*)$/s.exec(tokens[index] ?? "");
    if (!match) continue;
    const [, added = "-", deleted = "-", path = ""] = match;
    const renamed = path === "";
    const previousPath = renamed ? (tokens[index + 1] ?? "") : null;
    const newPath = renamed ? (tokens[index + 2] ?? "") : path;
    if (renamed) index += 2;
    if (newPath === "") continue;
    files.push({
      path: newPath,
      previousPath: previousPath || null,
      additions: added === "-" ? null : Number(added),
      deletions: deleted === "-" ? null : Number(deleted),
    });
  }
  return files;
}

const gitFailure = (cwd: string, operation: string, detail: string) =>
  new GitCommandError({ operation, command: "git", cwd, detail });

/** The newest commits of one branch (or all of them) in topological order. */
export const commitLog = Effect.fn("GitManager.commitLog")(function* (
  git: Git,
  input: VcsCommitLogInput,
): Effect.fn.Return<VcsCommitLogResult, GitCommandError> {
  const { cwd } = input;
  const operation = "GitManager.commitLog";
  const run = (args: ReadonlyArray<string>, maxOutputBytes?: number) =>
    git.execute({
      operation,
      cwd,
      args,
      allowNonZeroExit: true,
      timeoutMs: 30_000,
      ...(maxOutputBytes === undefined ? {} : { maxOutputBytes }),
    });
  const limit = input.limit ?? VCS_COMMIT_LOG_PAGE_SIZE;

  let revisions: ReadonlyArray<string>;
  if (input.ref === ALL_VCS_REFS) {
    revisions = ["--branches", "--remotes"];
  } else if (input.ref === undefined) {
    revisions = ["--end-of-options", "HEAD"];
  } else {
    // A branch name wins over a tag of the same name, as it does in the branch list.
    let resolved: string | null = null;
    for (const candidate of [`refs/heads/${input.ref}`, `refs/remotes/${input.ref}`]) {
      const verified = yield* run([
        "rev-parse",
        "--verify",
        "--quiet",
        "--end-of-options",
        candidate,
      ]);
      if (verified.exitCode === 0) {
        resolved = candidate;
        break;
      }
    }
    if (resolved === null) {
      return yield* gitFailure(cwd, operation, `Branch ${input.ref} does not exist.`);
    }
    revisions = ["--end-of-options", resolved];
  }

  const [log, current] = yield* Effect.all(
    [
      run(
        [
          "log",
          "--no-color",
          "--no-show-signature",
          // The graph needs every child before its parents; date order alone can break that.
          "--topo-order",
          "--decorate=short",
          `--max-count=${limit + 1}`,
          COMMIT_LOG_FORMAT,
          ...revisions,
          "--",
        ],
        16 * 1024 * 1024,
      ),
      run(["symbolic-ref", "--short", "-q", "HEAD"]),
    ],
    { concurrency: 2 },
  );
  // A repository without a commit has no HEAD to log: an empty list, not an error.
  const all = log.exitCode === 0 ? parseCommitLog(log.stdout) : [];
  return {
    isRepo: true,
    ref: input.ref === undefined || input.ref === ALL_VCS_REFS ? null : input.ref,
    currentBranch: current.exitCode === 0 ? current.stdout.trim() || null : null,
    commits: all.slice(0, limit),
    hasMore: all.length > limit,
  };
});

/** The message body and changed files of one commit. */
export const commitDetail = Effect.fn("GitManager.commitDetail")(function* (
  git: Git,
  input: VcsCommitDetailInput,
): Effect.fn.Return<VcsCommitDetailResult, GitCommandError> {
  const { cwd } = input;
  const operation = "GitManager.commitDetail";
  const run = (args: ReadonlyArray<string>) =>
    git.execute({
      operation,
      cwd,
      args,
      allowNonZeroExit: true,
      timeoutMs: 30_000,
      maxOutputBytes: 4 * 1024 * 1024,
    });
  const [message, changes] = yield* Effect.all(
    [
      run(["log", "-1", "--no-color", "--format=%H%x00%b", "--end-of-options", input.sha, "--"]),
      run([
        "show",
        "--no-color",
        "--diff-merges=first-parent",
        "-M",
        "--numstat",
        "-z",
        "--format=",
        "--end-of-options",
        input.sha,
        "--",
      ]),
    ],
    { concurrency: 2 },
  );
  if (message.exitCode !== 0 || changes.exitCode !== 0) {
    return yield* gitFailure(cwd, operation, `Commit ${input.sha} does not exist.`);
  }
  const [sha = input.sha, ...body] = message.stdout.split("\0");
  const files = parseNumstat(changes.stdout);
  return {
    sha: sha.trim(),
    body: body.join("\0").trim(),
    files: files.slice(0, COMMIT_DETAIL_FILE_LIMIT),
    truncated: files.length > COMMIT_DETAIL_FILE_LIMIT || changes.stdoutTruncated,
  };
});
