import {
  MEMORY_TEXT_MAX_CHARS,
  type MemoryImportEntry,
  type MemoryImportGroup,
  type MemoryScope,
  type ProjectId,
} from "@t3tools/contracts";

/** Claude Code names a project's folder after its path, every character outside A-Z, a-z, 0-9 a dash. */
export const claudeDirectoryName = (workspaceRoot: string) =>
  workspaceRoot.replace(/[^A-Za-z0-9]/g, "-");

export function matchProject(
  directory: string,
  projects: ReadonlyArray<{ readonly id: ProjectId; readonly workspaceRoot: string }>,
): ProjectId | null {
  return (
    projects.find((project) => claudeDirectoryName(project.workspaceRoot) === directory)?.id ?? null
  );
}

/** What about the person (user, feedback) holds anywhere; the rest is about one project. */
export const importScope = (kind: string | null): MemoryScope =>
  kind === "project" || kind === "reference" ? "project" : "user";

export type ImportProblem = "too_long" | "needs_project";

export function importProblem(
  entry: MemoryImportEntry,
  project: ProjectId | null,
): ImportProblem | null {
  if (Array.from(entry.text.trim()).length > MEMORY_TEXT_MAX_CHARS) return "too_long";
  if (importScope(entry.kind) === "project" && project === null) return "needs_project";
  return null;
}

export const entryKey = (directory: string, file: string) => `${directory}/${file}`;

export interface ImportItem {
  readonly key: string;
  readonly scope: MemoryScope;
  readonly projectId?: ProjectId;
  readonly text: string;
}

/** The saves a selection makes: entries with a problem are left out, and counted. */
export function planImport(
  groups: ReadonlyArray<MemoryImportGroup>,
  selected: ReadonlySet<string>,
  projectByDirectory: Readonly<Record<string, ProjectId | null>>,
): { readonly items: ReadonlyArray<ImportItem>; readonly blocked: number } {
  const items: ImportItem[] = [];
  let blocked = 0;
  for (const group of groups) {
    const project = projectByDirectory[group.directory] ?? null;
    for (const entry of group.entries) {
      const key = entryKey(group.directory, entry.file);
      if (!selected.has(key)) continue;
      if (importProblem(entry, project) !== null) {
        blocked += 1;
        continue;
      }
      const scope = importScope(entry.kind);
      items.push({
        key,
        scope,
        ...(scope === "project" && project !== null ? { projectId: project } : {}),
        text: entry.text.trim(),
      });
    }
  }
  return { items, blocked };
}
