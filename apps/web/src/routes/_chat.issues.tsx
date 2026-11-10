import type { EnvironmentId, IssueListSort, IssueListState, ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { IssuesPage } from "../components/issue/IssuesPage";

export interface IssuesSearch {
  state: IssueListState;
  issueSort?: IssueListSort;
  /** Only the issues the signed-in user opened, or that are assigned to them. */
  involves?: "author" | "assignee";
  q?: string;
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  number?: number;
}

export const Route = createFileRoute("/_chat/issues")({
  validateSearch: (raw: Record<string, unknown>): IssuesSearch => ({
    state: raw.state === "closed" || raw.state === "all" ? raw.state : "open",
    ...(raw.issueSort === "newest" || raw.issueSort === "oldest" || raw.issueSort === "comments"
      ? { issueSort: raw.issueSort }
      : {}),
    ...(raw.involves === "author" || raw.involves === "assignee" ? { involves: raw.involves } : {}),
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
