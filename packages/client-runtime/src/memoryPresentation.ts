import type { Memory, MemoryScope, MemorySyncPeer, ProjectId } from "@t3tools/contracts";

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

export const MEMORY_SCOPE_NAMES: Record<MemoryScope, string> = {
  user: "Global",
  environment: "This environment",
  project: "One project",
};

export const MEMORY_SCOPE_DESCRIPTIONS: Record<MemoryScope, string> = {
  user: "Every project, on every linked environment",
  environment: "Every project, on this environment only",
  project: "One project, on every environment that has its repository",
};

/** `all`, a scope, or `key:<project key>`; a plain string so a picker's value type stays simple. */
export type MemoryScopeFilter = string;

export const projectFilter = (projectKey: string): MemoryScopeFilter => `key:${projectKey}`;

export function filterMemories(
  memories: ReadonlyArray<Memory>,
  query: string,
  filter: MemoryScopeFilter,
): ReadonlyArray<Memory> {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return memories.filter(
    (memory) =>
      (filter === "all" ||
        memory.scope === filter ||
        (memory.projectKey !== null && projectFilter(memory.projectKey) === filter)) &&
      terms.every((term) => memory.text.toLowerCase().includes(term)),
  );
}

/** A project memory's project: this environment's title, else the name it was saved with. */
export function memoryScopeLabel(
  memory: Pick<Memory, "scope" | "projectId" | "projectLabel">,
  projectTitles: ReadonlyMap<ProjectId, string>,
): string {
  if (memory.scope !== "project") return MEMORY_SCOPE_NAMES[memory.scope];
  return (
    (memory.projectId === null ? undefined : projectTitles.get(memory.projectId)) ??
    memory.projectLabel ??
    "Removed project"
  );
}

/** One filter entry per project that has memories, named as its memories are. */
export function memoryProjectFilters(
  memories: ReadonlyArray<Memory>,
  projectTitles: ReadonlyMap<ProjectId, string>,
): ReadonlyArray<{ readonly value: MemoryScopeFilter; readonly label: string }> {
  const seen = new Map<string, string>();
  for (const memory of memories)
    if (memory.projectKey !== null && !seen.has(memory.projectKey))
      seen.set(memory.projectKey, memoryScopeLabel(memory, projectTitles));
  return [...seen]
    .map(([key, label]) => ({ value: projectFilter(key), label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Where a memory came from, when another environment saved it. */
export function memoryOriginLabel(
  memory: Pick<Memory, "originEnvironmentId">,
  peers: ReadonlyArray<MemorySyncPeer>,
): string | null {
  if (memory.originEnvironmentId === null) return null;
  const peer = peers.find((entry) => entry.environmentId === memory.originEnvironmentId);
  return `From ${peer?.label ?? "another environment"}`;
}

/**
 * What a save of an edited memory sends: its scope, and a project only when the user picked one,
 * so editing another environment's project memory keeps it where it is.
 */
export function memoryMoveTarget(
  editing: Pick<Memory, "scope" | "projectId"> | null,
  scope: MemoryScope,
  projectId: ProjectId | null,
): { readonly scope: MemoryScope; readonly projectId?: ProjectId } {
  if (scope !== "project" || projectId === null) return { scope };
  if (editing !== null && editing.scope === "project" && editing.projectId === projectId)
    return { scope };
  return { scope, projectId };
}
