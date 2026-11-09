import { describe, expect, it } from "vite-plus/test";
import { MemoryId, ProjectId, type Memory } from "@t3tools/contracts";

import { filterMemories, memoryScopeLabel } from "./memorySettings.logic";

const projectA = ProjectId.make("project:a");

const memory = (id: string, text: string, projectId: ProjectId | null = null): Memory => ({
  id: MemoryId.make(id),
  scope: projectId === null ? "user" : "project",
  projectId,
  text,
  source: "user",
  sourceThreadId: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
});

const all = [
  memory("a", "Prefer pnpm over npm"),
  memory("b", "Deploys go through Nomad", projectA),
  memory("c", "Reply in Polish"),
];

describe("filterMemories", () => {
  it("narrows by scope and requires every search word, ignoring case", () => {
    expect(filterMemories(all, "", "all")).toHaveLength(3);
    expect(filterMemories(all, "", "user").map((entry) => entry.id)).toEqual(["a", "c"]);
    expect(filterMemories(all, "", projectA).map((entry) => entry.id)).toEqual(["b"]);
    expect(filterMemories(all, "PNPM npm", "all").map((entry) => entry.id)).toEqual(["a"]);
    expect(filterMemories(all, "pnpm nomad", "all")).toEqual([]);
  });
});

describe("memoryScopeLabel", () => {
  it("names the project, and keeps a removed project's memory identifiable", () => {
    const titles = new Map([[projectA, "acme/app"]]);
    expect(memoryScopeLabel(all[0]!, titles)).toBe("All projects");
    expect(memoryScopeLabel(all[1]!, titles)).toBe("acme/app");
    expect(memoryScopeLabel(all[1]!, new Map())).toBe("Removed project");
  });
});
