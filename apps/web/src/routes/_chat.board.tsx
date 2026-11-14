import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "../components/board/BoardPage";

export interface BoardSearch {
  /** `environmentId:projectId` keys of the projects shown; absent means all. */
  projects?: string[];
}

export const Route = createFileRoute("/_chat/board")({
  validateSearch: (raw: Record<string, unknown>): BoardSearch => {
    const projects = Array.isArray(raw.projects)
      ? raw.projects.filter((key): key is string => typeof key === "string" && key !== "")
      : [];
    return projects.length > 0 ? { projects } : {};
  },
  component: BoardPage,
});
