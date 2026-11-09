import type { Memory, ProjectId } from "@t3tools/contracts";

// A state folder moved from `.t3` to `.ae` keeps its old scratch project at the old path, which the
// server no longer recognizes as the scratch project, so `isScratch` is not set on it.
const LEGACY_SCRATCH_ROOT = /[\\/]\.(?:t3|ae)[\\/]scratch$/;

/** The projects a memory can belong to: the environment's own, without its scratch project. */
export function selectableProjects<
  T extends {
    readonly environmentId: string;
    readonly workspaceRoot: string;
    readonly isScratch?: true | undefined;
  },
>(projects: ReadonlyArray<T>, environmentId: string): ReadonlyArray<T> {
  return projects.filter(
    (project) =>
      project.environmentId === environmentId &&
      project.isScratch !== true &&
      !LEGACY_SCRATCH_ROOT.test(project.workspaceRoot),
  );
}

/** `all`, `user`, or a project id; a plain string so a picker's value type stays simple. */
export type MemoryScopeFilter = string;

export function filterMemories(
  memories: ReadonlyArray<Memory>,
  query: string,
  scope: MemoryScopeFilter,
): ReadonlyArray<Memory> {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return memories.filter(
    (memory) =>
      (scope === "all" ||
        (scope === "user" ? memory.scope === "user" : memory.projectId === scope)) &&
      terms.every((term) => memory.text.toLowerCase().includes(term)),
  );
}

/** A project's memories stay listed after the project is gone, so they can still be forgotten. */
export function memoryScopeLabel(
  memory: Pick<Memory, "scope" | "projectId">,
  projectTitles: ReadonlyMap<ProjectId, string>,
): string {
  if (memory.scope === "user" || memory.projectId === null) return "All projects";
  return projectTitles.get(memory.projectId) ?? "Removed project";
}
