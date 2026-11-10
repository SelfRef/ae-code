import { lastOpenedProject, selectIssueProject } from "@t3tools/client-runtime/issue-projects";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

import { useQuietThreadShells } from "~/state/entities";

/** The project a page lists: the URL's, else the last chat's, else the first one. */
export function usePageProject(
  projects: Parameters<typeof selectIssueProject>[0],
  search: { environmentId?: EnvironmentId | undefined; projectId?: ProjectId | undefined },
) {
  const threads = useQuietThreadShells();
  return selectIssueProject(projects, search, lastOpenedProject(projects, threads));
}
