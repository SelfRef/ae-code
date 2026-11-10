import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type { EnvironmentProject } from "./state/models.ts";
import { describe, expect, it } from "vite-plus/test";

import { issueProjects, selectIssueProject } from "./issueProjects.ts";

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
});
