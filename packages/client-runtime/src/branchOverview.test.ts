import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import { threadForBranch } from "./branchOverview.ts";

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
