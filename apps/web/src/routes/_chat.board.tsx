import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "../components/board/BoardPage";

export interface BoardSearch {
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
}

export const Route = createFileRoute("/_chat/board")({
  validateSearch: (raw: Record<string, unknown>): BoardSearch =>
    typeof raw.environmentId === "string" &&
    raw.environmentId &&
    typeof raw.projectId === "string" &&
    raw.projectId
      ? { environmentId: raw.environmentId as EnvironmentId, projectId: raw.projectId as ProjectId }
      : {},
  component: BoardPage,
});
