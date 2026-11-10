import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import {
  ProviderDriverKind,
  ProviderInstanceId,
  type SkillLibraryError,
  type SkillLibrarySkill,
} from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process";

import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import * as SkillLibraryService from "./SkillLibraryService.ts";

const claude = ProviderInstanceId.make("claudeAgent");
const codex = ProviderInstanceId.make("codex");

const skillText = (name: string, description = "Does a thing") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;

/** A remote that "fetches" the files in `remote.files` at `remote.commit`. */
interface FakeRemote {
  commit: string;
  files: Record<string, string>;
  fetched: string[];
}

const withLibrary = <A, E>(
  use: (context: {
    readonly service: SkillLibraryService.SkillLibraryService["Service"];
    readonly home: string;
    readonly claudeSkills: string;
    readonly remote: FakeRemote;
    readonly fileSystem: FileSystem.FileSystem;
  }) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const home = yield* fileSystem.makeTempDirectoryScoped({ prefix: "skill-library-" });
    const claudeHome = `${home}/claude-home`;
    const remote: FakeRemote = { commit: "c1", files: {}, fetched: [] };
    const git = {
      execute: (input: GitVcsDriver.ExecuteGitInput) =>
        Effect.gen(function* () {
          let stdout = "";
          if (input.args.includes("fetch")) remote.fetched.push(input.args.join(" "));
          if (input.args.includes("checkout")) {
            for (const [file, content] of Object.entries(remote.files)) {
              yield* fileSystem.makeDirectory(
                `${input.cwd}/${file.slice(0, file.lastIndexOf("/"))}`,
                {
                  recursive: true,
                },
              );
              yield* fileSystem.writeFileString(`${input.cwd}/${file}`, content);
            }
          }
          if (input.args.includes("rev-parse")) stdout = `${remote.commit}\n`;
          return {
            exitCode: ChildProcessSpawner.ExitCode(0),
            stdout,
            stderr: "",
            stdoutTruncated: false,
            stderrTruncated: false,
          };
        }).pipe(Effect.orDie),
    };
    const dependencies = Layer.mergeAll(
      ServerSettings.layerTest({
        providerInstances: {
          [claude]: {
            driver: ProviderDriverKind.make("claudeAgent"),
            config: { homePath: claudeHome },
          },
        },
      }),
      Layer.succeed(ProviderRegistry.ProviderRegistry, {
        refreshInstance: () => Effect.succeed([]),
      } as unknown as ProviderRegistry.ProviderRegistry["Service"]),
      Layer.succeed(
        GitVcsDriver.GitVcsDriver,
        git as unknown as GitVcsDriver.GitVcsDriver["Service"],
      ),
      NodeCrypto.layer,
      Layer.succeed(HostProcess.HomeDirectory, home),
    );
    const service = yield* SkillLibraryService.SkillLibraryService.pipe(
      Effect.provide(SkillLibraryService.layer.pipe(Layer.provide(dependencies))),
    );
    return yield* use({ service, home, claudeSkills: `${claudeHome}/skills`, remote, fileSystem });
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

const byId = (skills: ReadonlyArray<SkillLibrarySkill>, id: string) =>
  skills.find((skill) => skill.id === id);
const stateOf = (skill: SkillLibrarySkill | undefined, instance: ProviderInstanceId) =>
  skill?.providers.find((provider) => provider.instanceId === instance)?.state;

it.effect("creates a skill, links it into Claude's folder and takes the link away again", () =>
  withLibrary(({ service, claudeSkills, fileSystem, home }) =>
    Effect.gen(function* () {
      yield* service.write({ id: "tidy", mode: "create", content: skillText("tidy") });
      const listed = yield* service.list();
      expect(listed.libraryPath).toBe(`${home}/.agents/skills`);
      const tidy = byId(listed.skills, "tidy");
      expect(tidy).toMatchObject({ name: "tidy", description: "Does a thing" });
      expect(tidy?.problem).toBeUndefined();
      // Codex reads the library itself; Claude needs a link.
      expect(stateOf(tidy, codex)).toBe("native");
      expect(stateOf(tidy, claude)).toBe("missing");

      expect((yield* service.setLink({ id: "tidy", instanceId: claude, linked: true })).state).toBe(
        "linked",
      );
      // Relative, so it also resolves from another mount of the same home.
      expect(yield* fileSystem.readLink(`${claudeSkills}/tidy`)).toBe("../../.agents/skills/tidy");
      expect(yield* fileSystem.readFileString(`${claudeSkills}/tidy/SKILL.md`)).toContain("tidy");

      expect(
        (yield* service.setLink({ id: "tidy", instanceId: claude, linked: false })).state,
      ).toBe("missing");
      expect(yield* fileSystem.exists(`${claudeSkills}/tidy`)).toBe(false);
    }),
  ),
);

it.effect("leaves a different skill of the same name in a provider's folder alone", () =>
  withLibrary(({ service, claudeSkills, fileSystem }) =>
    Effect.gen(function* () {
      yield* service.write({ id: "tidy", mode: "create", content: skillText("tidy") });
      yield* fileSystem.makeDirectory(`${claudeSkills}/tidy`, { recursive: true });
      yield* fileSystem.writeFileString(
        `${claudeSkills}/tidy/SKILL.md`,
        skillText("tidy", "Theirs"),
      );

      expect(stateOf(byId((yield* service.list()).skills, "tidy"), claude)).toBe("blocked");
      const refused = yield* service
        .setLink({ id: "tidy", instanceId: claude, linked: true })
        .pipe(Effect.flip);
      expect(refused.code).toBe("conflict");
      const unlinkRefused = yield* service
        .setLink({ id: "tidy", instanceId: claude, linked: false })
        .pipe(Effect.flip);
      expect(unlinkRefused.code).toBe("conflict");
      expect(yield* fileSystem.readFileString(`${claudeSkills}/tidy/SKILL.md`)).toContain("Theirs");

      const native = yield* service
        .setLink({ id: "tidy", instanceId: codex, linked: true })
        .pipe(Effect.flip);
      expect(native.code).toBe("invalid");
    }),
  ),
);

it.effect("checks what is written: names, frontmatter, duplicates and linked folders", () =>
  withLibrary(({ service, claudeSkills, home, fileSystem }) =>
    Effect.gen(function* () {
      const code = (effect: Effect.Effect<unknown, SkillLibraryError>) =>
        effect.pipe(
          Effect.flip,
          Effect.map((error) => error.code),
        );
      expect(
        yield* code(
          service.write({ id: "Bad Name", mode: "create", content: skillText("Bad Name") }),
        ),
      ).toBe("invalid");
      expect(yield* code(service.write({ id: "a", mode: "create", content: skillText("b") }))).toBe(
        "invalid",
      );
      expect(
        yield* code(service.write({ id: "../x", mode: "create", content: skillText("x") })),
      ).toBe("invalid");
      yield* service.write({ id: "a", mode: "create", content: skillText("a") });
      expect(yield* code(service.write({ id: "a", mode: "create", content: skillText("a") }))).toBe(
        "conflict",
      );

      yield* service.write({ id: "a", mode: "replace", content: skillText("a", "Changed") });
      expect((yield* service.read({ id: "a" })).content).toContain("Changed");
      expect(yield* code(service.write({ id: "nope", mode: "replace", content: "x" }))).toBe(
        "not_found",
      );

      // A folder that is a link elsewhere is edited where it lives, not through the library.
      yield* fileSystem.makeDirectory(`${home}/elsewhere/ext`, { recursive: true });
      yield* fileSystem.writeFileString(`${home}/elsewhere/ext/SKILL.md`, skillText("ext"));
      yield* fileSystem.symlink(`${home}/elsewhere/ext`, `${home}/.agents/skills/ext`);
      expect(
        yield* code(service.write({ id: "ext", mode: "replace", content: skillText("ext", "X") })),
      ).toBe("invalid");
      expect(yield* fileSystem.readFileString(`${home}/elsewhere/ext/SKILL.md`)).not.toContain("X");
      expect(claudeSkills).toContain("claude-home");
    }),
  ),
);

it.effect("flags a folder that is not a usable skill", () =>
  withLibrary(({ service, home, fileSystem }) =>
    Effect.gen(function* () {
      yield* fileSystem.makeDirectory(`${home}/.agents/skills/empty`, { recursive: true });
      yield* fileSystem.makeDirectory(`${home}/.agents/skills/.hidden`, { recursive: true });
      yield* fileSystem.makeDirectory(`${home}/.agents/skills/plain`, { recursive: true });
      yield* fileSystem.writeFileString(
        `${home}/.agents/skills/plain/SKILL.md`,
        "# No frontmatter",
      );
      const skills = (yield* service.list()).skills;
      expect(skills.map((skill) => skill.id)).toEqual(["empty", "plain"]);
      expect(byId(skills, "empty")?.problem).toMatch(/No SKILL\.md/);
      expect(byId(skills, "plain")?.problem).toMatch(/frontmatter/);
    }),
  ),
);

it.effect("trashes a skill with its links and restores it with them", () =>
  withLibrary(({ service, claudeSkills, fileSystem }) =>
    Effect.gen(function* () {
      yield* service.write({ id: "tidy", mode: "create", content: skillText("tidy") });
      yield* service.setLink({ id: "tidy", instanceId: claude, linked: true });

      const { trashId } = yield* service.remove({ id: "tidy" });
      const afterRemove = yield* service.list();
      expect(afterRemove.skills).toEqual([]);
      expect(afterRemove.trash.map((entry) => [entry.id, entry.skillId])).toEqual([
        [trashId, "tidy"],
      ]);
      // No dangling link is left behind.
      expect(yield* fileSystem.readLink(`${claudeSkills}/tidy`).pipe(Effect.option)).toMatchObject({
        _tag: "None",
      });

      yield* service.write({ id: "tidy", mode: "create", content: skillText("tidy", "Again") });
      expect((yield* service.restore({ trashId }).pipe(Effect.flip)).code).toBe("conflict");
      yield* service.remove({ id: "tidy" });

      expect((yield* service.restore({ trashId })).id).toBe("tidy");
      const restored = byId((yield* service.list()).skills, "tidy");
      expect(restored?.description).toBe("Does a thing");
      expect(stateOf(restored, claude)).toBe("linked");
      expect((yield* service.restore({ trashId }).pipe(Effect.flip)).code).toBe("not_found");
      expect((yield* service.restore({ trashId: "../x" }).pipe(Effect.flip)).code).toBe("invalid");
    }),
  ),
);

it.effect("installs skills from a source, lists them and updates one when the commit moves", () =>
  withLibrary(({ service, home, remote, fileSystem }) =>
    Effect.gen(function* () {
      remote.files = {
        "skills/alpha/SKILL.md": skillText("alpha"),
        "skills/alpha/scripts/run.sh": "echo hi",
        "skills/beta/SKILL.md": skillText("beta"),
        "README.md": "not a skill",
      };
      const inspected = yield* service.inspectSource({ source: "acme/skills" });
      expect(inspected.commit).toBe("c1");
      expect(inspected.skills.map((skill) => [skill.id, skill.path, skill.installed])).toEqual([
        ["alpha", "skills/alpha", false],
        ["beta", "skills/beta", false],
      ]);
      expect(remote.fetched[0]).toContain("fetch");

      const result = yield* service.install({
        source: "acme/skills",
        paths: ["skills/alpha", "skills/missing"],
      });
      expect(result.installed).toEqual(["alpha"]);
      expect(result.skipped).toEqual([
        { path: "skills/missing", reason: "Not found in that source." },
      ]);
      expect(yield* fileSystem.readFileString(`${home}/.agents/skills/alpha/scripts/run.sh`)).toBe(
        "echo hi",
      );
      expect(yield* fileSystem.exists(`${home}/.agents/skills/beta`)).toBe(false);
      // The staging folder is gone.
      expect(yield* fileSystem.readDirectory(`${home}/.agents/.skills-staging`)).toEqual([]);

      const alpha = byId((yield* service.list()).skills, "alpha");
      expect(alpha?.source).toMatchObject({
        source: "acme/skills",
        commit: "c1",
        path: "skills/alpha",
      });

      const again = yield* service.install({ source: "acme/skills", paths: ["skills/alpha"] });
      expect(again.installed).toEqual([]);
      expect(again.skipped[0]?.reason).toMatch(/Already installed/);

      expect((yield* service.update({ id: "alpha" })).status).toBe("current");
      remote.commit = "c2";
      remote.files["skills/alpha/SKILL.md"] = skillText("alpha", "Newer");
      expect((yield* service.update({ id: "alpha" })).status).toBe("updated");
      const updated = yield* service.list();
      expect(byId(updated.skills, "alpha")).toMatchObject({
        description: "Newer",
        source: { commit: "c2" },
      });
      expect(updated.trash.map((entry) => entry.skillId)).toEqual(["alpha"]);
    }),
  ),
);

it.effect("only fetches sources it can trust, and updates only what came from one", () =>
  withLibrary(({ service, remote }) =>
    Effect.gen(function* () {
      for (const source of ["file:///etc", "../repo", "/srv/repo", "-x/y"]) {
        expect((yield* service.inspectSource({ source }).pipe(Effect.flip)).code).toBe("invalid");
      }
      expect(
        (yield* service.inspectSource({ source: "acme/skills", ref: "--x" }).pipe(Effect.flip))
          .code,
      ).toBe("invalid");
      expect(remote.fetched).toEqual([]);

      yield* service.write({ id: "mine", mode: "create", content: skillText("mine") });
      expect((yield* service.update({ id: "mine" }).pipe(Effect.flip)).code).toBe("invalid");
    }),
  ),
);

it.effect(
  "installs a repository whose root is one skill, under the name its frontmatter gives",
  () =>
    withLibrary(({ service, remote }) =>
      Effect.gen(function* () {
        remote.files = { "SKILL.md": skillText("solo"), "notes/extra.md": "more" };
        const inspected = yield* service.inspectSource({ source: "acme/some-repo@solo" });
        expect(inspected.skills.map((skill) => [skill.id, skill.path])).toEqual([["solo", ""]]);
        expect(
          (yield* service.install({ source: "acme/some-repo", paths: [""] })).installed,
        ).toEqual(["solo"]);
        expect(byId((yield* service.list()).skills, "solo")).toBeDefined();
        expect(
          (yield* service.inspectSource({ source: "acme/some-repo@other" }).pipe(Effect.flip)).code,
        ).toBe("not_found");
      }),
    ),
);
