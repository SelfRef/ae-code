import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import * as ServerConfig from "../config.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import { commitDetail, commitLog, parseCommitLog, parseNumstat } from "./commitHistory.ts";

const layerTest = GitVcsDriver.layer.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-commit-history-" })),
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
);

const setup = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const git = yield* GitVcsDriver.GitVcsDriver;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "t3-commit-history-repo-" });
  const run = (...args: string[]) =>
    git
      .execute({ operation: "test", cwd, args, allowNonZeroExit: false })
      .pipe(Effect.map((result) => result.stdout.trim()));
  const commit = (file: string, message: string) =>
    Effect.gen(function* () {
      yield* fs.writeFileString(path.join(cwd, file), `${message}\n`);
      yield* run("add", file);
      yield* run("commit", "-m", message);
    });
  yield* run("init", "-b", "main");
  yield* run("config", "user.email", "test@test.com");
  yield* run("config", "user.name", "Test");
  yield* run("config", "commit.gpgsign", "false");
  return { git, cwd, run, commit };
});

describe("commitHistory", () => {
  it("parses decorations and renames", () => {
    const [entry] = parseCommitLog(
      "\u001eabc\u001fp1 p2\u001fAnn\u001f2026-01-01T00:00:00+00:00\u001fHEAD -> main, origin/main, origin/HEAD, tag: v1\u001fa\u001fb",
    );
    assert.deepEqual(entry?.parents, ["p1", "p2"]);
    assert.deepEqual(entry?.refs, ["main", "origin/main", "tag: v1"]);
    assert.equal(entry?.subject, "a\u001fb");
    assert.deepEqual(
      parseNumstat("1\t0\tnew.txt\0\n2\t3\t\0old.txt\0renamed.txt\0-\t-\timg.png\0"),
      [
        { path: "new.txt", previousPath: null, additions: 1, deletions: 0 },
        { path: "renamed.txt", previousPath: "old.txt", additions: 2, deletions: 3 },
        { path: "img.png", previousPath: null, additions: null, deletions: null },
      ],
    );
  });

  it.effect("lists a branch newest first with its merge parents, and caps it", () =>
    Effect.gen(function* () {
      const { git, cwd, run, commit } = yield* setup;
      yield* commit("a.txt", "first");
      yield* run("switch", "-c", "feature");
      yield* commit("b.txt", "on feature");
      yield* run("switch", "main");
      yield* commit("c.txt", "on main");
      yield* run("merge", "--no-ff", "feature", "-m", "merge feature");
      yield* run("switch", "-c", "other");
      yield* commit("d.txt", "only on other");
      yield* run("switch", "main");

      const head = yield* commitLog(git, { cwd });
      assert.equal(head.currentBranch, "main");
      assert.sameMembers(
        head.commits.map((entry) => entry.subject),
        ["merge feature", "on main", "on feature", "first"],
      );
      assert.equal(head.commits[0]?.subject, "merge feature");
      assert.equal(head.commits[0]?.parents.length, 2);
      assert.isTrue(head.commits[0]?.refs.includes("main"));
      assert.isFalse(head.commits.some((entry) => entry.subject === "only on other"));
      assert.isFalse(head.hasMore);

      const other = yield* commitLog(git, { cwd, ref: "other" });
      assert.equal(other.ref, "other");
      assert.equal(other.commits[0]?.subject, "only on other");
      const everything = yield* commitLog(git, { cwd, ref: "*" });
      assert.isNull(everything.ref);
      assert.isTrue(everything.commits.some((entry) => entry.subject === "only on other"));

      const page = yield* commitLog(git, { cwd, limit: 2 });
      assert.equal(page.commits.length, 2);
      assert.isTrue(page.hasMore);
      assert.isFalse((yield* commitLog(git, { cwd, limit: 4 })).hasMore);

      const failed = yield* commitLog(git, { cwd, ref: "missing" }).pipe(Effect.flip);
      assert.include(failed.message, "missing");
    }).pipe(Effect.scoped, Effect.provide(layerTest)),
  );

  it.effect("returns an empty list for a repository without commits", () =>
    Effect.gen(function* () {
      const { git, cwd } = yield* setup;
      const result = yield* commitLog(git, { cwd });
      assert.deepEqual(result.commits, []);
    }).pipe(Effect.scoped, Effect.provide(layerTest)),
  );

  it.effect("reads the message body and the files a commit changed", () =>
    Effect.gen(function* () {
      const { git, cwd, run, commit } = yield* setup;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* commit("old.txt", "first");
      yield* run("mv", "old.txt", "new.txt");
      yield* fs.writeFileString(path.join(cwd, "extra.txt"), "x\ny\n");
      yield* run("add", "extra.txt");
      yield* run("commit", "-m", "second", "-m", "The body.");
      const sha = yield* run("rev-parse", "HEAD");
      const detail = yield* commitDetail(git, { cwd, sha });
      assert.equal(detail.sha, sha);
      assert.equal(detail.body, "The body.");
      assert.deepEqual(
        detail.files.map((file) => [file.path, file.previousPath]),
        [
          ["extra.txt", null],
          ["new.txt", "old.txt"],
        ],
      );
      assert.equal(detail.files[0]?.additions, 2);
      const root = yield* commitDetail(git, {
        cwd,
        sha: yield* run("rev-list", "--max-parents=0", "HEAD"),
      });
      assert.deepEqual(
        root.files.map((file) => file.path),
        ["old.txt"],
      );
      const missing = yield* commitDetail(git, { cwd, sha: "deadbeef" }).pipe(Effect.flip);
      assert.include(missing.message, "deadbeef");
    }).pipe(Effect.scoped, Effect.provide(layerTest)),
  );
});
