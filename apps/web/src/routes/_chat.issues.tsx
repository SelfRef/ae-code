import type { EnvironmentId, IssueListState, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { IssuesPage } from "../components/issue/IssuesPage";

export interface IssuesSearch {
  state: IssueListState;
  q?: string | undefined;
  environmentId?: EnvironmentId | undefined;
  projectId?: ProjectId | undefined;
  number?: number | undefined;
}

export const Route = createFileRoute("/_chat/issues")({
  validateSearch: (raw: Record<string, unknown>): IssuesSearch => ({
    state: raw.state === "closed" || raw.state === "all" ? raw.state : "open",
    q: typeof raw.q === "string" && raw.q ? raw.q.slice(0, 200) : undefined,
    environmentId:
      typeof raw.environmentId === "string" && raw.environmentId
        ? (raw.environmentId as EnvironmentId)
        : undefined,
    projectId:
      typeof raw.projectId === "string" && raw.projectId ? (raw.projectId as ProjectId) : undefined,
    number:
      typeof raw.number === "number" && Number.isInteger(raw.number) && raw.number > 0
        ? raw.number
        : undefined,
  }),
  component: IssuesPage,
});
