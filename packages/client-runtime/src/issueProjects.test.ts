import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type { EnvironmentProject } from "./state/models.ts";
import { describe, expect, it } from "vite-plus/test";

import { issueProjects, lastOpenedProject, selectIssueProject } from "./issueProjects.ts";

const project = (
  id: string,
  title: string,
  provider: string | undefined,
  extra: Partial<EnvironmentProject> = {},
) =>
  ({
    environmentId: "env" as EnvironmentId,
    id: id as ProjectId,
    title,
    repositoryIdentity: provider === undefined ? null : { provider },
    ...extra,
  }) as unknown as EnvironmentProject;

describe("issueProjects", () => {
  it("keeps GitHub projects that are neither scratch nor archived, by title", () => {
    const projects = [
      project("b", "Beta", "github"),
      project("g", "Gitlab", "gitlab"),
      project("n", "No remote", undefined),
      project("s", "Scratch", "github", { isScratch: true }),
      project("x", "Archived", "github", { archivedAt: "2026-01-01T00:00:00Z" }),
      project("a", "Alpha", "github"),
    ];
    expect(issueProjects(projects).map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("selects the project named by the URL, else the first", () => {
    const projects = [project("a", "Alpha", "github"), project("b", "Beta", "github")];
    expect(
      selectIssueProject(projects, {
        environmentId: "env" as EnvironmentId,
        projectId: "b" as ProjectId,
      })?.id,
    ).toBe("b");
    expect(selectIssueProject(projects, { projectId: "gone" as ProjectId })?.id).toBe("a");
    expect(selectIssueProject([], {})).toBeNull();
  });

  it("falls back to the last chat's project before the first one", () => {
    const projects = [project("a", "Alpha", "github"), project("b", "Beta", "github")];
    const thread = (projectId: string, openedAt?: number) =>
      ({
        environmentId: "env" as EnvironmentId,
        projectId: projectId as ProjectId,
        opens: openedAt === undefined ? null : { openedAt, score: 1, picks: [] },
      }) as unknown as Parameters<typeof lastOpenedProject>[1][number];
    const last = lastOpenedProject(projects, [
      thread("a", 1),
      thread("b", 2),
      thread("gone", 3),
      thread("a"),
    ]);
    expect(last?.id).toBe("b");
    expect(selectIssueProject(projects, {}, last)?.id).toBe("b");
    expect(selectIssueProject(projects, { projectId: "gone" as ProjectId }, last)?.id).toBe("b");
    expect(lastOpenedProject(projects, [thread("a")])).toBeNull();
  });
});
