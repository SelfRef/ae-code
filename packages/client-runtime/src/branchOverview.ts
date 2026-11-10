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

export type BranchSort = "recent" | "oldest" | "ahead" | "name";
export type BranchKind = "branch" | "worktree" | "remote";
export type BranchMergeFilter = "unmerged" | "merged";
export interface BranchListFilters {
  readonly merge?: BranchMergeFilter | undefined;
  readonly kind?: BranchKind | undefined;
  readonly query?: string | undefined;
}

function branchKind(branch: Pick<VcsBranchOverviewEntry, "isRemoteOnly" | "worktreePath">) {
  return branch.isRemoteOnly ? "remote" : branch.worktreePath !== null ? "worktree" : "branch";
}

export function filterBranches<T extends VcsBranchOverviewEntry>(
  branches: ReadonlyArray<T>,
  filters: BranchListFilters,
): ReadonlyArray<T> {
  const query = filters.query?.trim().toLowerCase();
  return branches.filter(
    (branch) =>
      (filters.merge === undefined || branchMergeState(branch) === filters.merge) &&
      (filters.kind === undefined || branchKind(branch) === filters.kind) &&
      (!query || branch.name.toLowerCase().includes(query)),
  );
}

/** The default branch stays first; the server's order is latest commit first. */
export function sortBranches<T extends VcsBranchOverviewEntry>(
  branches: ReadonlyArray<T>,
  sort: BranchSort,
): ReadonlyArray<T> {
  if (sort === "recent") return branches;
  const compare = (left: T, right: T) =>
    sort === "name"
      ? left.name.localeCompare(right.name)
      : sort === "ahead"
        ? right.aheadOfDefault - left.aheadOfDefault
        : (left.lastCommitAt ?? "￿").localeCompare(right.lastCommitAt ?? "￿");
  return [...branches].sort(
    (left, right) => Number(right.isDefault) - Number(left.isDefault) || compare(left, right),
  );
}
