import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { BranchesPage } from "../components/branches/BranchesPage";

export interface BranchesSearch {
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  unmerged?: true;
}

export const Route = createFileRoute("/_chat/branches")({
  validateSearch: (raw: Record<string, unknown>): BranchesSearch => ({
    ...(typeof raw.environmentId === "string" && raw.environmentId
      ? { environmentId: raw.environmentId as EnvironmentId }
      : {}),
    ...(typeof raw.projectId === "string" && raw.projectId
      ? { projectId: raw.projectId as ProjectId }
      : {}),
    ...(raw.unmerged === true || raw.unmerged === "true" ? { unmerged: true as const } : {}),
  }),
  component: BranchesPage,
});
