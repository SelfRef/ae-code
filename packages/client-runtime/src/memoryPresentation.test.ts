import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, MemoryId, ProjectId, type Memory } from "@t3tools/contracts";

import {
  filterMemories,
  memoryMoveTarget,
  memoryOriginLabel,
  memoryProjectFilters,
  memoryScopeLabel,
  projectFilter,
  selectableProjects,
} from "./memoryPresentation.ts";

const projectA = ProjectId.make("project:a");
const peer = EnvironmentId.make("environment:laptop");

const memory = (id: string, text: string, overrides: Partial<Memory> = {}): Memory => ({
  id: MemoryId.make(id),
  scope: "user",
  projectId: null,
  projectKey: null,
  projectLabel: null,
  originEnvironmentId: null,
  text,
  source: "user",
  sourceThreadId: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

const all = [
  memory("a", "Prefer pnpm over npm"),
  memory("b", "Deploys go through Nomad", {
    scope: "project",
    projectId: projectA,
    projectKey: "github.com/acme/app",
    projectLabel: "acme/app",
  }),
  memory("c", "Reply in Polish", { scope: "environment" }),
  memory("d", "Staging is on Fly", {
    scope: "project",
    projectKey: "github.com/acme/site",
    projectLabel: "acme/site",
    originEnvironmentId: peer,
  }),
];

describe("filterMemories", () => {
  it("narrows by scope or project and requires every search word, ignoring case", () => {
    expect(filterMemories(all, "", "all")).toHaveLength(4);
    expect(filterMemories(all, "", "user").map((entry) => entry.id)).toEqual(["a"]);
    expect(filterMemories(all, "", "environment").map((entry) => entry.id)).toEqual(["c"]);
    expect(filterMemories(all, "", "project").map((entry) => entry.id)).toEqual(["b", "d"]);
    expect(
      filterMemories(all, "", projectFilter("github.com/acme/app")).map((entry) => entry.id),
    ).toEqual(["b"]);
    expect(filterMemories(all, "PNPM npm", "all").map((entry) => entry.id)).toEqual(["a"]);
    expect(filterMemories(all, "pnpm nomad", "all")).toEqual([]);
  });
});

describe("selectableProjects", () => {
  const project = (environmentId: string, workspaceRoot: string, isScratch?: true) => ({
    environmentId,
    workspaceRoot,
    ...(isScratch === undefined ? {} : { isScratch }),
  });

  it("keeps this environment's real projects, and drops its scratch project even after a state-folder move", () => {
    const projects = [
      project("env:a", "/home/me/Projects/app"),
      project("env:a", "/home/node/.ae/scratch", true),
      project("env:a", "/home/node/.t3/scratch"),
      project("env:a", "/home/me/Projects/scratch"),
      project("env:b", "/home/me/Projects/other"),
    ];
    expect(selectableProjects(projects, "env:a").map((entry) => entry.workspaceRoot)).toEqual([
      "/home/me/Projects/app",
      "/home/me/Projects/scratch",
    ]);
  });
});

describe("memoryScopeLabel", () => {
  it("names the project here, else by the name it was saved with", () => {
    const titles = new Map([[projectA, "App"]]);
    expect(memoryScopeLabel(all[0]!, titles)).toBe("Global");
    expect(memoryScopeLabel(all[1]!, titles)).toBe("App");
    expect(memoryScopeLabel(all[1]!, new Map())).toBe("acme/app");
    expect(memoryScopeLabel(all[3]!, titles)).toBe("acme/site");
    expect(memoryProjectFilters(all, titles).map((entry) => entry.label)).toEqual([
      "acme/site",
      "App",
    ]);
  });
});

describe("memoryOriginLabel", () => {
  it("names the environment that saved it, and says nothing for this one", () => {
    const peers = [{ environmentId: peer, label: "Laptop", lastSyncedAt: null, lastError: null }];
    expect(memoryOriginLabel(all[0]!, peers)).toBeNull();
    expect(memoryOriginLabel(all[3]!, peers)).toBe("From Laptop");
    expect(memoryOriginLabel(all[3]!, [])).toBe("From another environment");
  });
});

describe("memoryMoveTarget", () => {
  it("names a project only when the user picked another one", () => {
    expect(memoryMoveTarget(null, "project", projectA)).toEqual({
      scope: "project",
      projectId: projectA,
    });
    expect(memoryMoveTarget(all[1]!, "project", projectA)).toEqual({ scope: "project" });
    expect(memoryMoveTarget(all[3]!, "project", null)).toEqual({ scope: "project" });
    expect(memoryMoveTarget(all[3]!, "project", projectA)).toEqual({
      scope: "project",
      projectId: projectA,
    });
    expect(memoryMoveTarget(all[1]!, "environment", projectA)).toEqual({ scope: "environment" });
  });
});
