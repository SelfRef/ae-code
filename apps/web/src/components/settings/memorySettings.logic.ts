import type { Memory, ProjectId } from "@t3tools/contracts";

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
