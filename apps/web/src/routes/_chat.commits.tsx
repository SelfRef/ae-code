import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { CommitsPage } from "../components/commits/CommitsPage";

export interface CommitsSearch {
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  /** A branch as the branch list names it, or `*` for all of them; absent means the checked-out branch. */
  ref?: string;
}

export const Route = createFileRoute("/_chat/commits")({
  validateSearch: (raw: Record<string, unknown>): CommitsSearch => ({
    ...(typeof raw.environmentId === "string" && raw.environmentId
      ? { environmentId: raw.environmentId as EnvironmentId }
      : {}),
    ...(typeof raw.projectId === "string" && raw.projectId
      ? { projectId: raw.projectId as ProjectId }
      : {}),
    ...(typeof raw.ref === "string" && raw.ref ? { ref: raw.ref.slice(0, 250) } : {}),
  }),
  component: CommitsPage,
});
