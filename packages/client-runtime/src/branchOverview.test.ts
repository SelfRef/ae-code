import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import type { VcsBranchOverviewEntry } from "@t3tools/contracts";
import { filterBranches, sortBranches, threadForBranch } from "./branchOverview.ts";

const project = { environmentId: EnvironmentId.make("env"), id: ProjectId.make("project") };
const thread = (
  overrides: Partial<Parameters<typeof threadForBranch>[0][number]> & { id: string },
) => ({
  environmentId: project.environmentId,
  projectId: project.id,
  branch: null,
  worktreePath: null,
  archivedAt: null,
  deletedAt: null,
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

it("links a branch to its newest live thread, in the worktree or the project root", () => {
  const threads = [
    thread({ id: "old", branch: "feature", updatedAt: "2026-10-01T00:00:00.000Z" }),
    thread({ id: "new", branch: "feature" }),
    thread({ id: "archived", branch: "feature", archivedAt: "2026-11-05T00:00:00.000Z" }),
    thread({ id: "in-worktree", branch: "wt", worktreePath: "/wt" }),
    thread({ id: "other-project", branch: "feature", projectId: ProjectId.make("other") }),
  ];
  const branch = { name: "feature", worktreePath: null, isRemoteOnly: false };
  expect(threadForBranch(threads, project, branch)?.id).toBe("new");
  // A thread in a worktree does not claim the same branch name in the project root.
  expect(threadForBranch(threads, project, { ...branch, name: "wt" })).toBeNull();
  expect(
    threadForBranch(threads, project, { name: "wt", worktreePath: "/wt", isRemoteOnly: false })?.id,
  ).toBe("in-worktree");
  expect(threadForBranch(threads, project, { ...branch, isRemoteOnly: true })).toBeNull();
});

const entry = (
  name: string,
  extra: Partial<VcsBranchOverviewEntry> = {},
): VcsBranchOverviewEntry => ({
  name,
  isRemoteOnly: false,
  isDefault: false,
  current: false,
  worktreePath: null,
  upstream: null,
  upstreamGone: false,
  ahead: 0,
  behind: 0,
  aheadOfDefault: 0,
  behindDefault: 0,
  lastCommitAt: null,
  lastCommitSubject: "",
  ...extra,
});

it("filters by merge state, kind and name", () => {
  const branches = [
    entry("main", { isDefault: true }),
    entry("origin/feature", { isRemoteOnly: true, aheadOfDefault: 2 }),
    entry("wt", { worktreePath: "/wt" }),
  ];
  const names = (filters: Parameters<typeof filterBranches>[1]) =>
    filterBranches(branches, filters).map((b) => b.name);
  expect(names({ merge: "unmerged" })).toEqual(["origin/feature"]);
  expect(names({ merge: "merged" })).toEqual(["wt"]);
  expect(names({ kind: "worktree" })).toEqual(["wt"]);
  expect(names({ kind: "remote", query: " FEAT " })).toEqual(["origin/feature"]);
});

it("sorts with the default branch first", () => {
  const branches = [
    entry("main", { isDefault: true, lastCommitAt: "2026-11-01T00:00:00.000Z" }),
    entry("b", { aheadOfDefault: 1, lastCommitAt: "2026-11-03T00:00:00.000Z" }),
    entry("a", { aheadOfDefault: 5, lastCommitAt: "2026-11-02T00:00:00.000Z" }),
  ];
  const names = (sort: Parameters<typeof sortBranches>[1]) =>
    sortBranches(branches, sort).map((b) => b.name);
  expect(names("recent")).toEqual(["main", "b", "a"]);
  expect(names("oldest")).toEqual(["main", "a", "b"]);
  expect(names("ahead")).toEqual(["main", "a", "b"]);
  expect(names("name")).toEqual(["main", "a", "b"]);
});
