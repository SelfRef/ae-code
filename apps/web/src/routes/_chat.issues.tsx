import type { EnvironmentId, IssueListState, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { IssuesPage } from "../components/issue/IssuesPage";

export interface IssuesSearch {
  state: IssueListState;
  q?: string;
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  number?: number;
}

export const Route = createFileRoute("/_chat/issues")({
  validateSearch: (raw: Record<string, unknown>): IssuesSearch => ({
    state: raw.state === "closed" || raw.state === "all" ? raw.state : "open",
    ...(typeof raw.q === "string" && raw.q ? { q: raw.q.slice(0, 200) } : {}),
    ...(typeof raw.environmentId === "string" && raw.environmentId
      ? { environmentId: raw.environmentId as EnvironmentId }
      : {}),
    ...(typeof raw.projectId === "string" && raw.projectId
      ? { projectId: raw.projectId as ProjectId }
      : {}),
    ...(typeof raw.number === "number" && Number.isInteger(raw.number) && raw.number > 0
      ? { number: raw.number }
      : {}),
  }),
  component: IssuesPage,
});
