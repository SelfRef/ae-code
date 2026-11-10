import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type {
  BranchKind,
  BranchMergeFilter,
  BranchSort,
} from "@t3tools/client-runtime/branch-overview";
import { createFileRoute } from "@tanstack/react-router";

import { BranchesPage } from "../components/branches/BranchesPage";

export interface BranchesSearch {
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  merge?: BranchMergeFilter;
  /** A remote's name, or `all`; absent means the first remote. */
  remote?: string;
  kind?: BranchKind;
  branchSort?: BranchSort;
}

export const Route = createFileRoute("/_chat/branches")({
  validateSearch: (raw: Record<string, unknown>): BranchesSearch => ({
    ...(typeof raw.environmentId === "string" && raw.environmentId
      ? { environmentId: raw.environmentId as EnvironmentId }
      : {}),
    ...(typeof raw.projectId === "string" && raw.projectId
      ? { projectId: raw.projectId as ProjectId }
      : {}),
    ...(raw.merge === "unmerged" || raw.merge === "merged" ? { merge: raw.merge } : {}),
    ...(typeof raw.remote === "string" && raw.remote ? { remote: raw.remote.slice(0, 200) } : {}),
    ...(raw.kind === "branch" || raw.kind === "worktree" || raw.kind === "remote"
      ? { kind: raw.kind }
      : {}),
    ...(raw.branchSort === "oldest" || raw.branchSort === "ahead" || raw.branchSort === "name"
      ? { branchSort: raw.branchSort }
      : {}),
  }),
  component: BranchesPage,
});
