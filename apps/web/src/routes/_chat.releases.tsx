import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { ReleasesPage } from "../components/releases/ReleasesPage";

export interface ReleasesSearch {
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  id?: number;
}

export const Route = createFileRoute("/_chat/releases")({
  validateSearch: (raw: Record<string, unknown>): ReleasesSearch => ({
    ...(typeof raw.environmentId === "string" && raw.environmentId
      ? { environmentId: raw.environmentId as EnvironmentId }
      : {}),
    ...(typeof raw.projectId === "string" && raw.projectId
      ? { projectId: raw.projectId as ProjectId }
      : {}),
    ...(typeof raw.id === "number" && Number.isInteger(raw.id) && raw.id > 0 ? { id: raw.id } : {}),
  }),
  component: ReleasesPage,
});
