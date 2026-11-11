import {
  lastOpenedProject,
  projectKey,
  selectIssueProject,
} from "@t3tools/client-runtime/issue-projects";

import { useThreadShells } from "./entities";

type Projects = Parameters<typeof selectIssueProject>[0];

/** The project a tab lists: the one picked here, else the last chat's, else the first. */
export function usePageProject(projects: Projects, selectedKey: string | null) {
  const threads = useThreadShells();
  const picked = projects.find((candidate) => projectKey(candidate) === selectedKey);
  return picked ?? selectIssueProject(projects, {}, lastOpenedProject(projects, threads));
}
