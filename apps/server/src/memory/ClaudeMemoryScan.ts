// @effect-diagnostics nodeBuiltinImport:off - the home folder and path joins are plain host values.
import {
  MemoryError,
  type MemoryImportGroup,
  type MemoryImportScanInput,
  type MemoryImportScanResult,
} from "@t3tools/contracts";
import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { CLAUDE_MEMORY_INDEX_FILE, parseClaudeMemoryFile } from "./claudeMemoryFile.ts";

const DEFAULT_ROOT = "~/.claude/projects";
const MAX_FILE_BYTES = 64 * 1024;
const MAX_ENTRIES = 1000;

/**
 * Lists the memories in Claude Code's folders (`<root>/<project>/memory/*.md`) without saving any.
 * Only those files are read, so a settings page cannot be pointed at other files by a path.
 */
export const scanClaudeMemories = Effect.fn("ClaudeMemoryScan.scan")(function* (
  input: MemoryImportScanInput,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = NodePath.resolve(
    expandHomePath(input.path?.trim() || DEFAULT_ROOT, NodeOS.homedir()),
  );
  const directories = yield* fileSystem.readDirectory(root).pipe(
    Effect.mapError(
      () =>
        new MemoryError({
          code: "invalid",
          message: `Cannot read ${root} on this environment's disk. Give the folder that holds Claude's project folders there.`,
        }),
    ),
  );

  const groups: MemoryImportGroup[] = [];
  let entryCount = 0;
  for (const directory of directories.toSorted()) {
    if (entryCount >= MAX_ENTRIES) break;
    const memoryDirectory = NodePath.join(root, directory, "memory");
    const files = yield* fileSystem
      .readDirectory(memoryDirectory)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    const entries: MemoryImportGroup["entries"][number][] = [];
    for (const file of files.toSorted()) {
      if (entryCount >= MAX_ENTRIES) break;
      if (!file.toLowerCase().endsWith(".md") || file === CLAUDE_MEMORY_INDEX_FILE) continue;
      const filePath = NodePath.join(memoryDirectory, file);
      const info = yield* fileSystem.stat(filePath).pipe(Effect.option);
      if (
        info._tag === "None" ||
        info.value.type !== "File" ||
        Number(info.value.size) > MAX_FILE_BYTES
      )
        continue;
      const content = yield* fileSystem.readFileString(filePath).pipe(Effect.option);
      if (content._tag === "None") continue;
      const entry = parseClaudeMemoryFile(file, content.value);
      if (entry === null) continue;
      entries.push(entry);
      entryCount += 1;
    }
    if (entries.length > 0) groups.push({ directory, entries });
  }
  return { path: root, groups } satisfies MemoryImportScanResult;
});
