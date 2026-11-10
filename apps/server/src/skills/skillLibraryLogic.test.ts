import { describe, expect, it } from "@effect/vitest";

import {
  isSafeFolderId,
  isSpecSkillName,
  isValidGitRef,
  parseSkillFrontmatter,
  parseSkillSource,
  skillIdForSource,
} from "./skillLibraryLogic.ts";

describe("parseSkillSource", () => {
  it("reads owner/repo as GitHub and keeps an @skill pick", () => {
    expect(parseSkillSource("vercel-labs/agent-skills")).toEqual({
      url: "https://github.com/vercel-labs/agent-skills.git",
    });
    expect(parseSkillSource("vercel-labs/agent-skills@web-design")).toEqual({
      url: "https://github.com/vercel-labs/agent-skills.git",
      only: "web-design",
    });
  });

  it("accepts https, ssh and scp-style remotes", () => {
    for (const url of [
      "https://git.example.com/team/skills.git",
      "ssh://git@example.com/team/skills.git",
      "git@example.com:team/skills.git",
    ]) {
      expect(parseSkillSource(url)).toEqual({ url });
    }
  });

  it("refuses anything that could read the server's disk or act as a git option", () => {
    for (const source of [
      "file:///etc",
      "/srv/data/repo",
      "../repo",
      "./repo",
      "ext::sh -c id",
      "--upload-pack=id",
      "-owner/repo",
      "http://example.com/a.git",
      "owner/repo name",
      "",
    ]) {
      expect(parseSkillSource(source)).toBeUndefined();
    }
  });
});

describe("names and refs", () => {
  it("allows only one plain, visible path segment as a folder id", () => {
    expect(isSafeFolderId("my-skill")).toBe(true);
    for (const id of ["", ".", "..", ".hidden", "a/b", "a\\b", "a\0b", "x".repeat(129)]) {
      expect(isSafeFolderId(id)).toBe(false);
    }
  });

  it("applies the specification's name rule to new skills", () => {
    expect(isSpecSkillName("web-design-2")).toBe(true);
    for (const name of ["Web", "-a", "a-", "a--b", "a_b", "x".repeat(65)]) {
      expect(isSpecSkillName(name)).toBe(false);
    }
  });

  it("refuses refs that look like options or ranges", () => {
    expect(isValidGitRef("v1.2.3")).toBe(true);
    expect(isValidGitRef("feature/x")).toBe(true);
    expect(isValidGitRef("-x")).toBe(false);
    expect(isValidGitRef("a..b")).toBe(false);
  });

  it("names a repository's skill by its spec name, else by its folder", () => {
    expect(skillIdForSource({ folderName: "dir", frontmatterName: "nice-name" })).toBe("nice-name");
    expect(skillIdForSource({ folderName: "dir", frontmatterName: "Bad Name" })).toBe("dir");
    expect(skillIdForSource({ folderName: ".hidden", frontmatterName: undefined })).toBeUndefined();
  });
});

describe("parseSkillFrontmatter", () => {
  it("reads name and description, and tells a missing block from an empty one", () => {
    expect(parseSkillFrontmatter('---\nname: a\ndescription: "Does a thing"\n---\nBody')).toEqual({
      name: "a",
      description: "Does a thing",
    });
    expect(parseSkillFrontmatter("---\n---\nBody")).toBeUndefined();
    expect(parseSkillFrontmatter("No frontmatter")).toBeUndefined();
    expect(parseSkillFrontmatter("---\nname: [unclosed\n---\n")).toBeUndefined();
    expect(parseSkillFrontmatter("---\nname: a\n---\n")).toEqual({ name: "a" });
  });
});
