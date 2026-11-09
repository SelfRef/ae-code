import { describe, expect, it } from "vite-plus/test";
import { MEMORY_TEXT_MAX_CHARS, ProjectId, type MemoryImportGroup } from "@t3tools/contracts";

import {
  claudeDirectoryName,
  entryKey,
  importProblem,
  importScope,
  matchProject,
  planImport,
} from "./memoryImport.logic";

const cloud = ProjectId.make("project:cloud");

const entry = (file: string, kind: string | null, text = "A fact") => ({
  file,
  name: file,
  kind,
  text,
});

describe("claudeDirectoryName / matchProject", () => {
  it("names a folder the way Claude Code does, and finds the project whose path matches", () => {
    expect(claudeDirectoryName("/srv/docker/stacks/agents/external/ae-code")).toBe(
      "-srv-docker-stacks-agents-external-ae-code",
    );
    const projects = [
      { id: cloud, workspaceRoot: "/srv/docker/stacks/cloud" },
      { id: ProjectId.make("project:x"), workspaceRoot: "/home/node/Projects/x" },
    ];
    expect(matchProject("-srv-docker-stacks-cloud", projects)).toBe(cloud);
    expect(matchProject("-srv-docker-stacks-edge", projects)).toBeNull();
  });
});

describe("importScope", () => {
  it("keeps what is about the person global and what is about a project in the project", () => {
    expect(["user", "feedback", null, "odd"].map(importScope)).toEqual([
      "user",
      "user",
      "user",
      "user",
    ]);
    expect(["project", "reference"].map(importScope)).toEqual(["project", "project"]);
  });
});

describe("importProblem / planImport", () => {
  const groups: MemoryImportGroup[] = [
    {
      directory: "-srv-docker-stacks-cloud",
      entries: [
        entry("pref.md", "feedback", "Commits are one line"),
        entry("fact.md", "project", "Deploys use Nomad"),
        entry("huge.md", "user", "x".repeat(MEMORY_TEXT_MAX_CHARS + 1)),
        entry("unselected.md", "user"),
      ],
    },
  ];
  const selected = new Set(
    ["pref.md", "fact.md", "huge.md"].map((file) => entryKey(groups[0]!.directory, file)),
  );

  it("flags an oversized memory, and a project memory with no project", () => {
    expect(importProblem(groups[0]!.entries[2]!, null)).toBe("too_long");
    expect(importProblem(groups[0]!.entries[1]!, null)).toBe("needs_project");
    expect(importProblem(groups[0]!.entries[1]!, cloud)).toBeNull();
    expect(importProblem(groups[0]!.entries[0]!, null)).toBeNull();
  });

  it("saves only the selected, importable ones, in their scope, and counts the blocked", () => {
    expect(planImport(groups, selected, { "-srv-docker-stacks-cloud": cloud })).toEqual({
      items: [
        { key: "-srv-docker-stacks-cloud/pref.md", scope: "user", text: "Commits are one line" },
        {
          key: "-srv-docker-stacks-cloud/fact.md",
          scope: "project",
          projectId: cloud,
          text: "Deploys use Nomad",
        },
      ],
      blocked: 1,
    });
    // No project chosen: the project memory is blocked too, the personal one still imports.
    const without = planImport(groups, selected, {});
    expect(without.items.map((item) => item.key)).toEqual(["-srv-docker-stacks-cloud/pref.md"]);
    expect(without.blocked).toBe(2);
  });
});
