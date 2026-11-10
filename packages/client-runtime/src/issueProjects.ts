import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type { EnvironmentProject, EnvironmentThreadShell } from "./state/models.ts";

/** Projects whose repository is on a host whose issues the server can read. */
export function issueProjects(
  projects: ReadonlyArray<EnvironmentProject>,
  githubSignedOut?: ReadonlySet<EnvironmentId>,
): ReadonlyArray<EnvironmentProject> {
  return [...projects]
    .filter(
      (project) =>
        project.isScratch !== true &&
        !project.archivedAt &&
        project.repositoryIdentity?.provider === "github" &&
        !githubSignedOut?.has(project.environmentId),
    )
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function projectKey(project: Pick<EnvironmentProject, "environmentId" | "id">): string {
  return `${project.environmentId}:${project.id}`;
}

interface ProjectSelection {
  readonly environmentId?: EnvironmentId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/** The project of the thread opened most recently, among `projects`; null when none was opened. */
export function lastOpenedProject(
  projects: ReadonlyArray<EnvironmentProject>,
  threads: ReadonlyArray<Pick<EnvironmentThreadShell, "environmentId" | "projectId" | "opens">>,
): EnvironmentProject | null {
  let latest: { project: EnvironmentProject; openedAt: number } | null = null;
  for (const thread of threads) {
    const openedAt = thread.opens?.openedAt;
    if (openedAt === undefined || (latest !== null && openedAt <= latest.openedAt)) continue;
    const project = projects.find(
      (candidate) =>
        candidate.environmentId === thread.environmentId && candidate.id === thread.projectId,
    );
    if (project) latest = { project, openedAt };
  }
  return latest?.project ?? null;
}

/** The project named by the URL when it is listed, else `fallback` (the last chat's), else the first. */
export function selectIssueProject(
  projects: ReadonlyArray<EnvironmentProject>,
  selection: ProjectSelection,
  fallback?: Pick<EnvironmentProject, "environmentId" | "id"> | null,
): EnvironmentProject | null {
  return (
    projects.find(
      (project) =>
        project.environmentId === selection.environmentId && project.id === selection.projectId,
    ) ??
    projects.find(
      (project) => project.environmentId === fallback?.environmentId && project.id === fallback.id,
    ) ??
    projects[0] ??
    null
  );
}
