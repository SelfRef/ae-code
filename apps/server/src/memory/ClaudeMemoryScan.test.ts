import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import { scanClaudeMemories } from "./ClaudeMemoryScan.ts";

it.effect("lists only the memory files of each project folder, and saves nothing", () =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "claude-memory-scan-" });
    const write = (path: string, content: string) =>
      fileSystem
        .makeDirectory(`${root}/${path.slice(0, path.lastIndexOf("/"))}`, { recursive: true })
        .pipe(Effect.andThen(fileSystem.writeFileString(`${root}/${path}`, content)));

    yield* write(
      "-srv-app/memory/feedback-style.md",
      "---\nname: style\ndescription: Short commits\nmetadata:\n  type: feedback\n---\nOne line.\n",
    );
    yield* write("-srv-app/memory/MEMORY.md", "- [style](feedback-style.md)\n");
    yield* write("-srv-app/memory/notes.txt", "not markdown");
    yield* write("-srv-app/memory/huge.md", "x".repeat(70 * 1024));
    yield* write("-srv-app/memory/empty.md", "---\nname: e\n---\n");
    yield* write("-srv-app/sessions/other.md", "not a memory file");
    yield* write("-srv-other/memory/fact.md", "A plain fact.");
    yield* write("-srv-none/memory/MEMORY.md", "index only");
    yield* write("stray.md", "outside any project folder");

    const result = yield* scanClaudeMemories({ path: root });

    expect(result.path).toBe(root);
    expect(result.groups).toEqual([
      {
        directory: "-srv-app",
        entries: [
          {
            file: "feedback-style.md",
            name: "style",
            kind: "feedback",
            text: "Short commits\n\nOne line.",
          },
        ],
      },
      {
        directory: "-srv-other",
        entries: [{ file: "fact.md", name: "fact", kind: null, text: "A plain fact." }],
      },
    ]);
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("says which folder it could not read", () =>
  Effect.gen(function* () {
    const error = yield* scanClaudeMemories({ path: "/nonexistent/claude-projects" }).pipe(
      Effect.flip,
    );
    expect(error.code).toBe("invalid");
    expect(error.message).toContain("/nonexistent/claude-projects");
  }).pipe(Effect.provide(NodeServices.layer)),
);
