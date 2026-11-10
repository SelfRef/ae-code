// Workspace-relative paths use `/`; the workspace root is "".

export function entryParent(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function entryName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function joinEntryPath(parent: string, name: string): string {
  return parent === "" ? name : `${parent}/${name}`;
}

/** Whether `path` is `ancestor` or lies inside it. */
export function isSameOrInside(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

/** A message for a name the user cannot use, or null. `siblings` are the other names in the folder. */
export function entryNameError(name: string, siblings: Iterable<string>): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Enter a name.";
  if (trimmed === "." || trimmed === "..") return "That name is not allowed.";
  if (/[/\\\0]/.test(trimmed)) return "A name cannot contain / or \\.";
  if (trimmed.length > 255) return "That name is too long.";
  for (const sibling of siblings) {
    if (sibling.toLowerCase() === trimmed.toLowerCase()) return `"${trimmed}" already exists.`;
  }
  return null;
}

/** Whether a folder is a valid destination for moving `source`: not itself or inside itself. */
export function canMoveInto(source: { path: string; kind: "file" | "directory" }, folder: string) {
  if (source.kind === "directory" && isSameOrInside(folder, source.path)) return false;
  return true;
}
