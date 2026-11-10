import type { VcsBranchOverviewEntry } from "@t3tools/contracts";
import type { EnvironmentProject, EnvironmentThreadShell } from "./state/models.ts";

/** Projects the Branches page can list: every real project that is not archived. */
export function branchProjects(
  projects: ReadonlyArray<EnvironmentProject>,
): ReadonlyArray<EnvironmentProject> {
  return [...projects]
    .filter((project) => project.isScratch !== true && !project.archivedAt)
    .sort((left, right) => left.title.localeCompare(right.title));
}

/**
 * Where the branch stands against the default branch: `unmerged` has commits the default lacks, so
 * it is what this page exists to surface. A branch that is only behind (or equal) holds nothing to merge.
 */
export function branchMergeState(
  branch: VcsBranchOverviewEntry,
): "default" | "unmerged" | "merged" {
  return branch.isDefault ? "default" : branch.aheadOfDefault > 0 ? "unmerged" : "merged";
}

type BranchThread = Pick<
  EnvironmentThreadShell,
  | "environmentId"
  | "projectId"
  | "branch"
  | "worktreePath"
  | "archivedAt"
  | "deletedAt"
  | "updatedAt"
>;

/** The newest live thread working on this branch: in its worktree, or on the branch in the project root. */
export function threadForBranch<T extends BranchThread>(
  threads: ReadonlyArray<T>,
  project: Pick<EnvironmentProject, "environmentId" | "id">,
  branch: Pick<VcsBranchOverviewEntry, "name" | "worktreePath" | "isRemoteOnly">,
): T | null {
  if (branch.isRemoteOnly) return null;
  let found: T | null = null;
  for (const thread of threads) {
    if (
      thread.environmentId !== project.environmentId ||
      thread.projectId !== project.id ||
      thread.archivedAt !== null ||
      thread.deletedAt !== null ||
      (branch.worktreePath !== null
        ? thread.worktreePath !== branch.worktreePath
        : thread.branch !== branch.name || thread.worktreePath !== null)
    ) {
      continue;
    }
    if (found === null || thread.updatedAt > found.updatedAt) found = thread;
  }
  return found;
}
