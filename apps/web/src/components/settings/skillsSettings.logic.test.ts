import { describe, expect, it } from "vite-plus/test";

import {
  filterSkills,
  isValidSkillName,
  providerOwnSkills,
  skillSourceLabel,
  skillTemplate,
} from "./skillsSettings.logic";

const librarySkill = (id: string, description?: string) =>
  ({
    id,
    name: id,
    ...(description === undefined ? {} : { description }),
    path: `/home/u/.agents/skills/${id}`,
    modifiedAt: "2026-11-10T00:00:00.000Z",
    providers: [],
  }) as never;

describe("skillTemplate", () => {
  it("writes frontmatter that quotes any description on one line", () => {
    expect(skillTemplate("tidy", 'Does "x":\n  y')).toBe(
      '---\nname: tidy\ndescription: "Does \\"x\\": y"\n---\n\n# tidy\n\n',
    );
  });
});

describe("isValidSkillName", () => {
  it("follows the specification's rule", () => {
    expect(isValidSkillName("web-design-2")).toBe(true);
    for (const name of ["", "Web", "a--b", "-a", "a_b", "x".repeat(65)]) {
      expect(isValidSkillName(name)).toBe(false);
    }
  });
});

describe("filterSkills", () => {
  it("matches every word against the id, name and description", () => {
    const skills = [librarySkill("tidy", "Cleans up code"), librarySkill("deploy")];
    expect(filterSkills(skills, "clean code").map((skill) => skill.id)).toEqual(["tidy"]);
    expect(filterSkills(skills, "DEP").map((skill) => skill.id)).toEqual(["deploy"]);
    expect(filterSkills(skills, "").length).toBe(2);
  });
});

describe("skillSourceLabel", () => {
  it("names the repository, the folder in it and a short commit", () => {
    const base = { source: "acme/skills", commit: "0123456789abcdef", installedAt: "x" };
    expect(skillSourceLabel({ ...base, path: "" })).toBe("acme/skills @ 0123456");
    expect(skillSourceLabel({ ...base, path: "skills/a" })).toBe(
      "acme/skills · skills/a @ 0123456",
    );
  });
});

describe("providerOwnSkills", () => {
  it("lists what a provider loads on its own, once per name, without library skills", () => {
    const library = {
      libraryPath: "/home/u/.agents/skills",
      skills: [librarySkill("tidy")],
    };
    const providers = [
      {
        instanceId: "claudeAgent",
        displayName: "Claude",
        enabled: true,
        skills: [
          { name: "tidy", path: "/home/u/.claude/skills/tidy/SKILL.md", enabled: true },
          { name: "plug", path: "/p/SKILL.md", scope: "user", enabled: true },
          { name: "plug", path: "/q/SKILL.md", scope: "user", enabled: true },
          { name: "other", path: "/home/u/.agents/skills/other/SKILL.md", enabled: true },
        ],
      },
      {
        instanceId: "off",
        displayName: "Off",
        enabled: false,
        skills: [{ name: "z", path: "/z", enabled: true }],
      },
    ] as never;
    expect(providerOwnSkills(providers, library)).toEqual([
      {
        instanceId: "claudeAgent",
        displayName: "Claude",
        skills: [{ name: "plug", path: "/p/SKILL.md", scope: "user" }],
      },
    ]);
  });
});
