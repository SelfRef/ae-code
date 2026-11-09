import { describe, expect, it } from "@effect/vitest";
import { MemoryId, type Memory } from "@t3tools/contracts";

import { memoryTerms, rankMemories } from "./memoryRanking.ts";

const NOW = Date.parse("2026-11-09T00:00:00.000Z");

const memory = (id: string, text: string, overrides: Partial<Memory> = {}): Memory => ({
  id: MemoryId.make(id),
  scope: "user",
  projectId: null,
  text,
  source: "user",
  sourceThreadId: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

const ids = (memories: ReadonlyArray<Memory>) => memories.map((entry) => entry.id);

describe("memoryTerms", () => {
  it("splits any script into lowercase terms and drops one-character noise", () => {
    expect(memoryTerms("Use pnpm, not NPM! 日本語 a")).toEqual([
      "use",
      "pnpm",
      "not",
      "npm",
      "日本語",
    ]);
  });
});

describe("rankMemories", () => {
  it("keeps the given order without a query, and drops memories that share no term", () => {
    const all = [memory("a", "tabs over spaces"), memory("b", "prefer pnpm")];
    expect(ids(rankMemories(all, "  ", NOW))).toEqual(["a", "b"]);
    expect(ids(rankMemories(all, "kubernetes", NOW))).toEqual([]);
  });

  it("puts the memory with the rarer matching term first", () => {
    const all = [
      memory("common", "the project uses the usual layout"),
      memory("rare", "deploys go through nomad"),
      memory("noise", "the layout is the usual one"),
    ];
    expect(ids(rankMemories(all, "the nomad", NOW))[0]).toBe("rare");
  });

  it("matches a word by its long prefix, not by short fragments", () => {
    const all = [memory("a", "Dockerfile lives in infra")];
    expect(ids(rankMemories(all, "docker", NOW))).toEqual(["a"]);
    expect(ids(rankMemories(all, "doc", NOW))).toEqual([]);
  });

  it("prefers project memory and recent memory when relevance ties", () => {
    const all = [
      memory("old-user", "format with oxfmt", { updatedAt: "2025-01-01T00:00:00.000Z" }),
      memory("new-user", "format with oxfmt", { updatedAt: "2026-11-08T00:00:00.000Z" }),
      memory("project", "format with oxfmt", {
        scope: "project",
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];
    expect(ids(rankMemories(all, "oxfmt", NOW))).toEqual(["new-user", "project", "old-user"]);
  });
});
