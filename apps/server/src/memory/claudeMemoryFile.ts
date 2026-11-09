import type { MemoryImportEntry } from "@t3tools/contracts";

/** The index file lists the others; importing it would save every memory twice. */
export const CLAUDE_MEMORY_INDEX_FILE = "MEMORY.md";

const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const field = (block: string, key: string) =>
  new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m").exec(block)?.[1]?.replace(/^["']|["']$/g, "");

/**
 * One file of Claude Code's memory folder: a frontmatter block (`name`, `description`, and a
 * `type` of user, feedback, project or reference) and a body. A file without frontmatter is its
 * body. Null when there is nothing to save.
 */
export function parseClaudeMemoryFile(file: string, content: string): MemoryImportEntry | null {
  const match = frontmatter.exec(content);
  const header = match?.[1] ?? "";
  const body = (match?.[2] ?? content).trim();
  const description = field(header, "description") ?? "";
  const text = [description, body].filter((part) => part !== "").join("\n\n");
  if (text === "") return null;
  return {
    file,
    name: field(header, "name") ?? file.replace(/\.md$/i, ""),
    kind: field(header, "type") ?? null,
    text,
  };
}
