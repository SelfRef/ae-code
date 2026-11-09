import { describe, expect, it } from "@effect/vitest";

import { parseClaudeMemoryFile } from "./claudeMemoryFile.ts";

describe("parseClaudeMemoryFile", () => {
  it("reads name, description, nested type and body", () => {
    const entry = parseClaudeMemoryFile(
      "feedback-commits.md",
      [
        "---",
        "name: feedback-commits",
        'description: "Commits are one line"',
        "metadata:",
        "  node_type: memory",
        "  type: feedback",
        "---",
        "",
        "Use Conventional Commits.",
        "",
        "**Why:** the owner reads history.",
      ].join("\n"),
    );
    expect(entry).toEqual({
      file: "feedback-commits.md",
      name: "feedback-commits",
      kind: "feedback",
      text: "Commits are one line\n\nUse Conventional Commits.\n\n**Why:** the owner reads history.",
    });
  });

  it("takes a top-level type, tolerates CRLF, and falls back to the file name and the whole body", () => {
    expect(
      parseClaudeMemoryFile("a.md", "---\r\ntype: project\r\ndescription: d\r\n---\r\nbody\r\n")
        ?.kind,
    ).toBe("project");
    expect(parseClaudeMemoryFile("plain-note.md", "Just a note.\n")).toEqual({
      file: "plain-note.md",
      name: "plain-note",
      kind: null,
      text: "Just a note.",
    });
  });

  it("returns null for a file with nothing to save", () => {
    expect(parseClaudeMemoryFile("empty.md", "---\nname: x\n---\n  \n")).toBeNull();
    expect(parseClaudeMemoryFile("blank.md", "")).toBeNull();
  });
});
