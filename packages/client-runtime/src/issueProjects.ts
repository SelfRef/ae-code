import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type { EnvironmentProject } from "./state/models.ts";

/** Projects whose repository is on a host whose issues the server can read. */
export function issueProjects(
  projects: ReadonlyArray<EnvironmentProject>,
): ReadonlyArray<EnvironmentProject> {
  return [...projects]
    .filter(
      (project) =>
        project.isScratch !== true &&
        !project.archivedAt &&
        project.repositoryIdentity?.provider === "github",
    )
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function projectKey(project: Pick<EnvironmentProject, "environmentId" | "id">): string {
  return `${project.environmentId}:${project.id}`;
}

/** The project named by the URL when it still lists issues, else the first one that does. */
export function selectIssueProject(
  projects: ReadonlyArray<EnvironmentProject>,
  selection: {
    readonly environmentId?: EnvironmentId | undefined;
    readonly projectId?: ProjectId | undefined;
  },
): EnvironmentProject | null {
  return (
    projects.find(
      (project) =>
        project.environmentId === selection.environmentId && project.id === selection.projectId,
    ) ??
    projects[0] ??
    null
  );
}
