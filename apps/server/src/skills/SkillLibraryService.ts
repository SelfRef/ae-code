import {
  ClaudeSettings,
  resolveProviderInstanceEnabled,
  SKILL_FILE_MAX_BYTES,
  DEFAULT_SKILL_LIBRARY_SETTINGS,
  SkillLibrarySettings,
  SkillLibraryError,
  SkillLibrarySource,
  type ProviderInstanceId,
  type SkillLibraryImportCandidate,
  type SkillLibraryImportInput,
  type SkillLibraryImportResult,
  type SkillLibraryImportScanResult,
  type SkillLibraryInspectSourceInput,
  type SkillLibraryInspectSourceResult,
  type SkillLibraryInstallInput,
  type SkillLibraryInstallResult,
  type SkillLibraryListResult,
  type SkillLibraryProviderState,
  type SkillLibraryReadInput,
  type SkillLibraryReadResult,
  type SkillLibraryRemoveInput,
  type SkillLibraryRemoveResult,
  type SkillLibraryRestoreInput,
  type SkillLibraryRestoreResult,
  type SkillLibrarySetLinkInput,
  type SkillLibrarySetLinkResult,
  type SkillLibrarySetSettingsInput,
  type SkillLibrarySetSettingsResult,
  type SkillLibrarySkill,
  type SkillLibraryTarget,
  type SkillLibraryTrashEntry,
  type SkillLibraryUpdateInput,
  type SkillLibraryUpdateResult,
  type SkillLibraryWriteInput,
  type SkillLibraryWriteResult,
} from "@t3tools/contracts";
import { setClaudeSkillAllowlistSource } from "@t3tools/provider-core/server/skillPolicy";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { resolveClaudeHomePath } from "../provider/Drivers/ClaudeHome.ts";
import {
  antigravityUserSkillDirectories,
  resolveAntigravityUserHome,
} from "../provider/Drivers/AntigravitySkills.ts";
import { deriveProviderInstanceConfigMap } from "../provider/ProviderInstanceRegistryHydration.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import {
  isSafeFolderId,
  isSpecSkillName,
  isValidGitRef,
  parseSkillFrontmatter,
  parseSkillSource,
  skillIdForSource,
  TRASH_ID_PATTERN,
  trashIdFor,
} from "./skillLibraryLogic.ts";

export class SkillLibraryService extends Context.Service<
  SkillLibraryService,
  {
    readonly list: () => Effect.Effect<SkillLibraryListResult, SkillLibraryError>;
    readonly read: (
      input: SkillLibraryReadInput,
    ) => Effect.Effect<SkillLibraryReadResult, SkillLibraryError>;
    readonly write: (
      input: SkillLibraryWriteInput,
    ) => Effect.Effect<SkillLibraryWriteResult, SkillLibraryError>;
    readonly remove: (
      input: SkillLibraryRemoveInput,
    ) => Effect.Effect<SkillLibraryRemoveResult, SkillLibraryError>;
    readonly restore: (
      input: SkillLibraryRestoreInput,
    ) => Effect.Effect<SkillLibraryRestoreResult, SkillLibraryError>;
    readonly setLink: (
      input: SkillLibrarySetLinkInput,
    ) => Effect.Effect<SkillLibrarySetLinkResult, SkillLibraryError>;
    readonly inspectSource: (
      input: SkillLibraryInspectSourceInput,
    ) => Effect.Effect<SkillLibraryInspectSourceResult, SkillLibraryError>;
    readonly install: (
      input: SkillLibraryInstallInput,
    ) => Effect.Effect<SkillLibraryInstallResult, SkillLibraryError>;
    readonly update: (
      input: SkillLibraryUpdateInput,
    ) => Effect.Effect<SkillLibraryUpdateResult, SkillLibraryError>;
    readonly setSettings: (
      input: SkillLibrarySetSettingsInput,
    ) => Effect.Effect<SkillLibrarySetSettingsResult, SkillLibraryError>;
    readonly scanImport: () => Effect.Effect<SkillLibraryImportScanResult, SkillLibraryError>;
    readonly importSkills: (
      input: SkillLibraryImportInput,
    ) => Effect.Effect<SkillLibraryImportResult, SkillLibraryError>;
  }
>()("t3/skills/SkillLibraryService") {}

// Providers that read `~/.agents/skills` themselves (each one's own discovery code, or its docs).
const NATIVE_DRIVERS = new Set(["codex", "cursor", "opencode", "pi", "fx"]);
// Providers with a skills folder of their own that does not include `~/.agents/skills`.
const HOME_LINK_DIRECTORIES: Readonly<Record<string, ReadonlyArray<string>>> = {
  grok: [".grok", "skills"],
  kiro: [".kiro", "skills"],
};

const TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_TRASH_ENTRIES = 50;
const MAX_LISTED_FILES = 200;
const MAX_IMPORT_CANDIDATES = 500;
const MAX_LIST_DEPTH = 3;
const MAX_DISCOVERED_SKILLS = 200;
const MAX_DISCOVERY_DEPTH = 4;
const MAX_DISCOVERY_DIRECTORIES = 2000;
const MAX_COPY_FILES = 2000;
const MAX_COPY_BYTES = 20 * 1024 * 1024;
const GIT_TIMEOUT_MS = 120_000;
// No tty, so a credential prompt fails instead of hanging; only https and ssh remotes are
// followed, so a repository cannot redirect a fetch to a local path.
const GIT_ENV = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  LANGUAGE: "C",
  GIT_ALLOW_PROTOCOL: "https:ssh",
} satisfies NodeJS.ProcessEnv;

const LockFile = Schema.Struct({
  version: Schema.Literal(1),
  skills: Schema.Record(Schema.String, SkillLibrarySource),
  settings: Schema.optional(SkillLibrarySettings),
});
type LockFile = typeof LockFile.Type;
const decodeLockFile = Schema.decodeUnknownOption(Schema.fromJsonString(LockFile));
const encodeLockFile = Schema.encodeSync(Schema.fromJsonString(LockFile));

const TrashManifest = Schema.Struct({
  skillId: Schema.String,
  deletedAt: Schema.String,
  source: Schema.optional(SkillLibrarySource),
  linked: Schema.Array(Schema.String),
});
const decodeTrashManifest = Schema.decodeUnknownOption(Schema.fromJsonString(TrashManifest));
const encodeTrashManifest = Schema.encodeSync(Schema.fromJsonString(TrashManifest));

const decodeClaudeSettings = Schema.decodeUnknownOption(ClaudeSettings);

const fail = (code: SkillLibraryError["code"], message: string) =>
  new SkillLibraryError({ code, message });

const unavailable = (what: string) => (cause: { readonly message: string }) =>
  fail("unavailable", `${what}: ${cause.message}`);

const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* HostProcess.HomeDirectory;
  const platform = yield* HostProcess.Platform;
  const settingsService = yield* ServerSettingsService;
  const providerRegistry = yield* ProviderRegistry.ProviderRegistry;
  const git = yield* GitVcsDriver.GitVcsDriver;
  const random = yield* SecureRandom.SecureRandom;
  const mutations = yield* Semaphore.make(1);
  const serviceScope = yield* Effect.scope;

  const agentsDirectory = path.join(home, ".agents");
  const libraryPath = path.join(agentsDirectory, "skills");
  const lockPath = path.join(agentsDirectory, ".ae-skills.json");
  const trashDirectory = path.join(agentsDirectory, ".skills-trash");
  const stagingDirectory = path.join(agentsDirectory, ".skills-staging");

  const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const io = (what: string) => Effect.mapError(unavailable(what));
  const exists = (target: string) =>
    fileSystem.exists(target).pipe(Effect.orElseSucceed(() => false));
  const randomSuffix = random.uuidV4().pipe(
    Effect.map((uuid) => uuid.replace(/-/g, "").slice(0, 6)),
    io("Could not create an id"),
  );

  const requireId = (id: string) =>
    isSafeFolderId(id)
      ? Effect.succeed(id)
      : Effect.fail(fail("invalid", `"${id}" is not a skill folder name.`));
  const libraryFolder = (id: string) => path.join(libraryPath, id);

  const writeFileAtomic = Effect.fn("SkillLibraryService.writeFileAtomic")(function* (
    target: string,
    text: string,
  ) {
    const temporary = `${target}.${yield* randomSuffix}.tmp`;
    yield* fileSystem.writeFileString(temporary, text).pipe(
      Effect.andThen(fileSystem.rename(temporary, target)),
      Effect.tapError(() => fileSystem.remove(temporary, { force: true }).pipe(Effect.ignore)),
      io(`Could not write ${path.basename(target)}`),
    );
  });

  // The lock file records where an installed skill came from; losing it only loses updates.
  const readLock = fileSystem.readFileString(lockPath).pipe(
    Effect.map((text) => decodeLockFile(text)),
    Effect.map(Option.getOrElse((): LockFile => ({ version: 1, skills: {} }))),
    Effect.orElseSucceed((): LockFile => ({ version: 1, skills: {} })),
  );
  const writeLock = Effect.fn("SkillLibraryService.writeLock")(function* (lock: LockFile) {
    yield* fileSystem
      .makeDirectory(agentsDirectory, { recursive: true })
      .pipe(io("Could not create ~/.agents"));
    yield* writeFileAtomic(lockPath, encodeLockFile(lock));
  });
  const updateLock = Effect.fn("SkillLibraryService.updateLock")(function* (
    change: (skills: Record<string, SkillLibrarySource>) => void,
  ) {
    const lock = yield* readLock;
    const skills = { ...lock.skills };
    change(skills);
    yield* writeLock({ ...lock, skills });
  });

  // Targets: how each enabled provider instance reaches the library.
  const resolveTargets = Effect.fn("SkillLibraryService.resolveTargets")(function* () {
    const settings = yield* settingsService.getSettings.pipe(io("Could not read settings"));
    const targets: SkillLibraryTarget[] = [];
    for (const [instanceId, instance] of Object.entries(
      deriveProviderInstanceConfigMap(settings),
    )) {
      if (!resolveProviderInstanceEnabled(instance) || instance.hidden === true) continue;
      const driver = String(instance.driver);
      const base = {
        instanceId: instanceId as ProviderInstanceId,
        driver: instance.driver,
        displayName: instance.displayName ?? driver,
      };
      if (NATIVE_DRIVERS.has(driver)) {
        targets.push({ ...base, mode: "native" });
        continue;
      }
      const environment = yield* mergeProviderInstanceEnvironment(instance.environment);
      let linkDirectory: string | undefined;
      if (driver === "claudeAgent") {
        const decoded = decodeClaudeSettings(instance.config ?? {});
        const rawHome = (instance.config as { homePath?: unknown } | undefined)?.homePath;
        const homePath = Option.isSome(decoded)
          ? decoded.value.homePath
          : typeof rawHome === "string"
            ? rawHome
            : "";
        const claudeHome = yield* resolveClaudeHomePath({ homePath }, environment).pipe(
          Effect.provideService(Path.Path, path),
        );
        linkDirectory = path.join(claudeHome, "skills");
      } else if (driver === "antigravity") {
        const userHome = resolveAntigravityUserHome(platform, environment, home);
        linkDirectory = antigravityUserSkillDirectories(path, path.join(userHome, ".gemini"))[0];
      } else {
        const segments = HOME_LINK_DIRECTORIES[driver];
        if (segments !== undefined) linkDirectory = path.join(home, ...segments);
      }
      targets.push(
        linkDirectory === undefined
          ? { ...base, mode: "none" }
          : { ...base, mode: "link", linkDirectory },
      );
    }
    return targets;
  });

  // Does the link at `linkPath` lead to `folder`? Compared as written first, so a link left
  // dangling by a removal still counts, then by real path for a symlinked home.
  const pointsAt = Effect.fn("SkillLibraryService.pointsAt")(function* (
    linkPath: string,
    folder: string,
  ) {
    const target = yield* fileSystem.readLink(linkPath).pipe(Effect.option);
    if (Option.isNone(target)) return false;
    const resolved = path.resolve(path.dirname(linkPath), target.value);
    if (resolved === folder) return true;
    const [real, expected] = yield* Effect.all([
      fileSystem.realPath(resolved).pipe(Effect.option),
      fileSystem.realPath(folder).pipe(Effect.option),
    ]);
    return Option.isSome(real) && Option.isSome(expected) && real.value === expected.value;
  });

  const providerState = Effect.fn("SkillLibraryService.providerState")(function* (
    target: SkillLibraryTarget,
    id: string,
  ): Effect.fn.Return<SkillLibraryProviderState> {
    if (target.mode === "native") return "native";
    if (target.mode === "none" || target.linkDirectory === undefined) return "unsupported";
    const linkPath = path.join(target.linkDirectory, id);
    const isLink = yield* fileSystem.readLink(linkPath).pipe(Effect.option);
    if (Option.isSome(isLink)) {
      return (yield* pointsAt(linkPath, libraryFolder(id))) ? "linked" : "blocked";
    }
    return (yield* exists(linkPath)) ? "blocked" : "missing";
  });

  const readSkillFile = Effect.fn("SkillLibraryService.readSkillFile")(function* (folder: string) {
    const file = path.join(folder, "SKILL.md");
    const info = yield* fileSystem.stat(file);
    if (info.type !== "File" || Number(info.size) > SKILL_FILE_MAX_BYTES) {
      return { text: undefined, info } as const;
    }
    return { text: yield* fileSystem.readFileString(file), info } as const;
  });
  const readSkillFileOption = (folder: string) => readSkillFile(folder).pipe(Effect.option);

  const describeSkill = Effect.fn("SkillLibraryService.describeSkill")(function* (
    id: string,
    targets: ReadonlyArray<SkillLibraryTarget>,
    lock: LockFile,
  ): Effect.fn.Return<SkillLibrarySkill | undefined> {
    const folder = libraryFolder(id);
    const folderInfo = yield* fileSystem.stat(folder).pipe(Effect.option);
    if (Option.isNone(folderInfo) || folderInfo.value.type !== "Directory") return undefined;
    const file = yield* readSkillFileOption(folder);
    const frontmatter =
      Option.isSome(file) && file.value.text !== undefined
        ? parseSkillFrontmatter(file.value.text)
        : undefined;
    const problem = Option.isNone(file)
      ? "No SKILL.md in this folder."
      : file.value.text === undefined
        ? "SKILL.md is too large or not a file."
        : frontmatter === undefined
          ? "SKILL.md has no valid frontmatter."
          : frontmatter.description === undefined
            ? "SKILL.md has no description."
            : undefined;
    const modified = Option.isSome(file) ? file.value.info.mtime : folderInfo.value.mtime;
    const source = lock.skills[id];
    const providers = yield* Effect.forEach(targets, (target) =>
      providerState(target, id).pipe(
        Effect.map((state) => ({ instanceId: target.instanceId, state })),
      ),
    );
    return {
      id,
      name: frontmatter?.name ?? id,
      ...(frontmatter?.description === undefined ? {} : { description: frontmatter.description }),
      path: folder,
      ...(problem === undefined ? {} : { problem }),
      modifiedAt: DateTime.formatIso(DateTime.makeUnsafe(Option.getOrElse(modified, () => 0))),
      ...(source === undefined ? {} : { source }),
      providers,
    };
  });

  const listTrash = Effect.fn("SkillLibraryService.listTrash")(function* () {
    const names = yield* fileSystem
      .readDirectory(trashDirectory)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    const nowMs = DateTime.toEpochMillis(yield* DateTime.now);
    const entries: SkillLibraryTrashEntry[] = [];
    for (const name of names) {
      if (!TRASH_ID_PATTERN.test(name)) continue;
      const directory = path.join(trashDirectory, name);
      const manifest = yield* fileSystem.readFileString(path.join(directory, "manifest.json")).pipe(
        Effect.map((text) => decodeTrashManifest(text)),
        Effect.orElseSucceed(() => Option.none<typeof TrashManifest.Type>()),
      );
      if (Option.isNone(manifest)) continue;
      if (nowMs - Date.parse(manifest.value.deletedAt) > TRASH_RETENTION_MS) {
        yield* fileSystem.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore);
        continue;
      }
      entries.push({
        id: name,
        skillId: manifest.value.skillId,
        deletedAt: manifest.value.deletedAt,
      });
    }
    return entries.toSorted((a, b) => b.id.localeCompare(a.id)).slice(0, MAX_TRASH_ENTRIES);
  });

  const list = Effect.fn("SkillLibraryService.list")(function* () {
    const targets = yield* resolveTargets();
    const lock = yield* readLock;
    const names = yield* fileSystem
      .readDirectory(libraryPath)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    const described = yield* Effect.forEach(
      names.filter(isSafeFolderId).toSorted((a, b) => a.localeCompare(b)),
      (id) => describeSkill(id, targets, lock),
      { concurrency: 8 },
    );
    return {
      libraryPath,
      skills: described.filter((skill): skill is SkillLibrarySkill => skill !== undefined),
      targets,
      trash: yield* listTrash(),
      settings: lock.settings ?? DEFAULT_SKILL_LIBRARY_SETTINGS,
    };
  });

  const requireFolder = Effect.fn("SkillLibraryService.requireFolder")(function* (id: string) {
    yield* requireId(id);
    const folder = libraryFolder(id);
    const info = yield* fileSystem.stat(folder).pipe(Effect.option);
    if (Option.isNone(info) || info.value.type !== "Directory") {
      return yield* fail("not_found", `There is no skill "${id}" in the library.`);
    }
    return folder;
  });

  const listFiles = Effect.fn("SkillLibraryService.listFiles")(function* (folder: string) {
    const files: string[] = [];
    let truncated = false;
    const queue: Array<{ readonly relative: string; readonly depth: number }> = [
      { relative: "", depth: 0 },
    ];
    for (let index = 0; index < queue.length && !truncated; index += 1) {
      const current = queue[index];
      if (current === undefined) break;
      const names = yield* fileSystem
        .readDirectory(path.join(folder, current.relative))
        .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
      for (const name of names.toSorted((a, b) => a.localeCompare(b))) {
        if (name === ".git") continue;
        const relative = current.relative === "" ? name : path.join(current.relative, name);
        if (relative === "SKILL.md") continue;
        const info = yield* fileSystem.stat(path.join(folder, relative)).pipe(Effect.option);
        if (Option.isNone(info)) continue;
        if (info.value.type === "Directory") {
          if (current.depth + 1 < MAX_LIST_DEPTH)
            queue.push({ relative, depth: current.depth + 1 });
          continue;
        }
        if (files.length >= MAX_LISTED_FILES) {
          truncated = true;
          break;
        }
        files.push(relative);
      }
    }
    return { files, truncated };
  });

  const read = Effect.fn("SkillLibraryService.read")(function* (input: SkillLibraryReadInput) {
    const folder = yield* requireFolder(input.id);
    const file = yield* readSkillFileOption(folder);
    if (Option.isNone(file) || file.value.text === undefined) {
      return yield* fail("not_found", `"${input.id}" has no readable SKILL.md.`);
    }
    const listing = yield* listFiles(folder);
    return {
      id: input.id,
      content: file.value.text,
      files: listing.files,
      filesTruncated: listing.truncated,
    };
  });

  const writeLocked = Effect.fn("SkillLibraryService.writeLocked")(function* (
    input: SkillLibraryWriteInput,
  ) {
    yield* requireId(input.id);
    if (input.content.trim().length === 0) {
      return yield* fail("invalid", "SKILL.md cannot be empty.");
    }
    const folder = libraryFolder(input.id);
    if (input.mode === "create") {
      if (!isSpecSkillName(input.id)) {
        return yield* fail(
          "invalid",
          "A skill name has lowercase letters, digits and single hyphens, at most 64 characters.",
        );
      }
      if (parseSkillFrontmatter(input.content)?.name !== input.id) {
        return yield* fail("invalid", `SKILL.md needs frontmatter with name: ${input.id}.`);
      }
      if (
        (yield* exists(folder)) ||
        Option.isSome(yield* fileSystem.readLink(folder).pipe(Effect.option))
      ) {
        return yield* fail("conflict", `A skill named "${input.id}" already exists.`);
      }
      yield* fileSystem
        .makeDirectory(folder, { recursive: true })
        .pipe(io("Could not create the skill"));
      yield* writeFileAtomic(path.join(folder, "SKILL.md"), input.content).pipe(
        Effect.tapError(() =>
          fileSystem.remove(folder, { recursive: true, force: true }).pipe(Effect.ignore),
        ),
      );
    } else {
      yield* requireFolder(input.id);
      if (Option.isSome(yield* fileSystem.readLink(folder).pipe(Effect.option))) {
        return yield* fail(
          "invalid",
          "This skill is a link to a folder elsewhere; edit it where it lives.",
        );
      }
      yield* writeFileAtomic(path.join(folder, "SKILL.md"), input.content);
    }
    return { id: input.id };
  });

  const write = Effect.fn("SkillLibraryService.write")(function* (input: SkillLibraryWriteInput) {
    return yield* mutations.withPermits(1)(writeLocked(input));
  });

  // The chat's skill menu reads each provider's snapshot, and a project's own snapshot keeps for a few
  // minutes, so those are refreshed too.
  const refreshProviderNow = Effect.fn("SkillLibraryService.refreshProvider")(function* (
    instanceId: ProviderInstanceId,
  ) {
    const providers = yield* providerRegistry.refreshInstance(instanceId);
    const folders =
      providers.find((provider) => provider.instanceId === instanceId)?.workspaceSnapshots ?? [];
    yield* Effect.forEach(
      folders,
      (snapshot) =>
        providerRegistry.refreshWorkspaceSnapshot({ instanceId, cwd: snapshot.cwd, fresh: true }),
      { concurrency: 2, discard: true },
    );
  });
  const refreshProvider = (instanceId: ProviderInstanceId) =>
    refreshProviderNow(instanceId).pipe(Effect.ignore, Effect.forkIn(serviceScope));

  const unlink = (linkPath: string) =>
    fileSystem.remove(linkPath, { force: true }).pipe(io("Could not remove the link"));

  const createLink = Effect.fn("SkillLibraryService.createLink")(function* (
    target: SkillLibraryTarget & { readonly linkDirectory: string },
    id: string,
  ) {
    yield* fileSystem
      .makeDirectory(target.linkDirectory, { recursive: true })
      .pipe(io("Could not create the provider's skills folder"));
    // Relative, so the link also resolves when the home is seen from another mount.
    const relative = path.relative(target.linkDirectory, libraryFolder(id));
    yield* fileSystem
      .symlink(relative, path.join(target.linkDirectory, id))
      .pipe(io("Could not create the link"));
  });

  /** Moves a skill to the trash. With `unlink`, the provider links that led to it go too. */
  const trashSkill = Effect.fn("SkillLibraryService.trashSkill")(function* (
    id: string,
    unlinkProviders: boolean,
  ) {
    yield* requireId(id);
    const folder = libraryFolder(id);
    const present =
      (yield* exists(folder)) ||
      Option.isSome(yield* fileSystem.readLink(folder).pipe(Effect.option));
    if (!present) return yield* fail("not_found", `There is no skill "${id}" in the library.`);
    const targets = yield* resolveTargets();
    const linked: Array<{ readonly instanceId: string; readonly linkPath: string }> = [];
    if (unlinkProviders) {
      for (const target of targets) {
        if (target.linkDirectory === undefined) continue;
        const linkPath = path.join(target.linkDirectory, id);
        if (yield* pointsAt(linkPath, folder))
          linked.push({ instanceId: target.instanceId, linkPath });
      }
    }
    const deletedAt = yield* now;
    const trashId = trashIdFor(deletedAt, yield* randomSuffix);
    const directory = path.join(trashDirectory, trashId);
    yield* fileSystem
      .makeDirectory(directory, { recursive: true })
      .pipe(io("Could not create the trash"));
    yield* fileSystem.rename(folder, path.join(directory, "skill")).pipe(
      Effect.tapError(() =>
        fileSystem.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore),
      ),
      io("Could not move the skill to the trash"),
    );
    const lock = yield* readLock;
    const source = lock.skills[id];
    yield* writeFileAtomic(
      path.join(directory, "manifest.json"),
      encodeTrashManifest({
        skillId: id,
        deletedAt,
        ...(source === undefined ? {} : { source }),
        linked: linked.map((entry) => entry.instanceId),
      }),
    );
    for (const entry of linked) {
      yield* unlink(entry.linkPath).pipe(Effect.ignore);
      yield* refreshProvider(entry.instanceId as ProviderInstanceId);
    }
    return trashId;
  });

  const remove = Effect.fn("SkillLibraryService.remove")(function* (
    input: SkillLibraryRemoveInput,
  ) {
    return yield* mutations.withPermits(1)(
      Effect.gen(function* () {
        const trashId = yield* trashSkill(input.id, true);
        yield* updateLock((skills) => {
          delete skills[input.id];
        });
        return { trashId };
      }),
    );
  });

  const restore = Effect.fn("SkillLibraryService.restore")(function* (
    input: SkillLibraryRestoreInput,
  ) {
    if (!TRASH_ID_PATTERN.test(input.trashId)) return yield* fail("invalid", "Not a trash entry.");
    return yield* mutations.withPermits(1)(
      Effect.gen(function* () {
        const directory = path.join(trashDirectory, input.trashId);
        const manifest = yield* fileSystem
          .readFileString(path.join(directory, "manifest.json"))
          .pipe(
            Effect.map((text) => decodeTrashManifest(text)),
            Effect.orElseSucceed(() => Option.none<typeof TrashManifest.Type>()),
          );
        if (Option.isNone(manifest) || !isSafeFolderId(manifest.value.skillId)) {
          return yield* fail("not_found", "That trash entry is gone.");
        }
        const { skillId, source, linked } = manifest.value;
        const folder = libraryFolder(skillId);
        if (yield* exists(folder)) {
          return yield* fail(
            "conflict",
            `A skill named "${skillId}" exists again; remove or rename it first.`,
          );
        }
        yield* fileSystem
          .makeDirectory(libraryPath, { recursive: true })
          .pipe(io("Could not create the library"));
        yield* fileSystem
          .rename(path.join(directory, "skill"), folder)
          .pipe(io("Could not restore the skill"));
        yield* fileSystem.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore);
        if (source !== undefined) {
          yield* updateLock((skills) => {
            skills[skillId] = source;
          });
        }
        const targets = yield* resolveTargets();
        for (const target of targets) {
          if (target.linkDirectory === undefined || !linked.includes(target.instanceId)) continue;
          if ((yield* providerState(target, skillId)) !== "missing") continue;
          yield* createLink({ ...target, linkDirectory: target.linkDirectory }, skillId).pipe(
            Effect.ignore,
          );
          yield* refreshProvider(target.instanceId);
        }
        return { id: skillId };
      }),
    );
  });

  const setLink = Effect.fn("SkillLibraryService.setLink")(function* (
    input: SkillLibrarySetLinkInput,
  ) {
    yield* requireFolder(input.id);
    const targets = yield* resolveTargets();
    const target = targets.find((candidate) => candidate.instanceId === input.instanceId);
    if (target === undefined) return yield* fail("not_found", "That provider is not enabled here.");
    if (target.mode === "native") {
      return yield* fail(
        "invalid",
        `${target.displayName} reads the library itself; there is nothing to link.`,
      );
    }
    if (target.mode === "none" || target.linkDirectory === undefined) {
      return yield* fail("invalid", `${target.displayName} has no skills folder to link into.`);
    }
    const linkable = { ...target, linkDirectory: target.linkDirectory };
    return yield* mutations.withPermits(1)(
      Effect.gen(function* () {
        const state = yield* providerState(target, input.id);
        if (input.linked) {
          if (state === "blocked") {
            return yield* fail(
              "conflict",
              `${target.displayName} already has a different skill named "${input.id}" in ${target.linkDirectory}.`,
            );
          }
          if (state === "missing") yield* createLink(linkable, input.id);
        } else if (state === "linked") {
          yield* unlink(path.join(linkable.linkDirectory, input.id));
        } else if (state === "blocked") {
          return yield* fail("conflict", "That is not a link made here, so it is left alone.");
        }
        yield* refreshProvider(target.instanceId);
        return { state: yield* providerState(target, input.id) };
      }),
    );
  });

  // Fetching a source: a shallow clone in a staging folder that is always removed.
  const withCheckout = Effect.fn("SkillLibraryService.withCheckout")(function* <A, E, R>(
    sourceText: string,
    ref: string | undefined,
    use: (checkout: string, commit: string, only: string | undefined) => Effect.Effect<A, E, R>,
  ) {
    const parsed = parseSkillSource(sourceText);
    if (parsed === undefined) {
      return yield* fail(
        "invalid",
        "A source is owner/repo, owner/repo@skill, or an https or ssh git URL.",
      );
    }
    if (ref !== undefined && !isValidGitRef(ref)) {
      return yield* fail("invalid", `"${ref}" is not a branch, tag or commit.`);
    }
    yield* fileSystem
      .makeDirectory(stagingDirectory, { recursive: true })
      .pipe(io("Could not create the staging folder"));
    const checkout = yield* fileSystem
      .makeTempDirectory({ directory: stagingDirectory, prefix: "clone-" })
      .pipe(io("Could not create the staging folder"));
    const runGit = (operation: string, args: ReadonlyArray<string>) =>
      git
        .execute({
          operation: `SkillLibraryService.${operation}`,
          cwd: checkout,
          args,
          timeoutMs: GIT_TIMEOUT_MS,
          env: GIT_ENV,
        })
        .pipe(
          Effect.mapError((cause) =>
            fail("unavailable", `Could not fetch ${parsed.url}: ${cause.message}`),
          ),
        );
    return yield* Effect.gen(function* () {
      yield* runGit("init", ["init", "--quiet"]);
      yield* runGit("remote", ["remote", "add", "origin", parsed.url]);
      yield* runGit("fetch", ["fetch", "--quiet", "--depth", "1", "origin", ref ?? "HEAD"]);
      // core.symlinks=false turns a repository's links into plain files, so no copy can follow one out.
      yield* runGit("checkout", ["-c", "core.symlinks=false", "checkout", "--quiet", "FETCH_HEAD"]);
      const head = yield* runGit("revParse", ["rev-parse", "HEAD"]);
      return yield* use(checkout, head.stdout.trim(), parsed.only);
    }).pipe(
      Effect.ensuring(
        fileSystem.remove(checkout, { recursive: true, force: true }).pipe(Effect.ignore),
      ),
    );
  });

  interface FoundSkill {
    readonly path: string;
    readonly id: string;
    readonly name: string;
    readonly description: string | undefined;
  }

  // Skill folders in a checkout: the repository root, `skills/*`, `.agents/skills/*` and the like.
  const discoverSkills = Effect.fn("SkillLibraryService.discoverSkills")(function* (
    checkout: string,
    repositoryName: string,
  ) {
    const found = new Map<string, FoundSkill>();
    const queue: Array<{ readonly relative: string; readonly depth: number }> = [
      { relative: "", depth: 0 },
    ];
    for (let index = 0; index < queue.length && index < MAX_DISCOVERY_DIRECTORIES; index += 1) {
      const current = queue[index];
      if (current === undefined || found.size >= MAX_DISCOVERED_SKILLS) break;
      const directory = path.join(checkout, current.relative);
      const file = yield* readSkillFileOption(directory);
      if (Option.isSome(file) && file.value.text !== undefined) {
        const frontmatter = parseSkillFrontmatter(file.value.text);
        const id = skillIdForSource({
          folderName: current.relative === "" ? repositoryName : path.basename(current.relative),
          frontmatterName: frontmatter?.name,
        });
        if (id !== undefined && !found.has(id)) {
          found.set(id, {
            path: current.relative,
            id,
            name: frontmatter?.name ?? id,
            description: frontmatter?.description,
          });
        }
        continue;
      }
      if (current.depth >= MAX_DISCOVERY_DEPTH) continue;
      const names = yield* fileSystem
        .readDirectory(directory)
        .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
      for (const name of names.toSorted((a, b) => a.localeCompare(b))) {
        if (name === ".git" || name === "node_modules") continue;
        const info = yield* fileSystem.stat(path.join(directory, name)).pipe(Effect.option);
        if (Option.isSome(info) && info.value.type === "Directory") {
          queue.push({
            relative: current.relative === "" ? name : path.join(current.relative, name),
            depth: current.depth + 1,
          });
        }
      }
    }
    return [...found.values()];
  });

  const repositoryNameOf = (source: string) =>
    (
      source
        .replace(/\.git$/, "")
        .split(/[/:]/)
        .pop() ?? "skill"
    ).toLowerCase();

  const inspectSource = Effect.fn("SkillLibraryService.inspectSource")(function* (
    input: SkillLibraryInspectSourceInput,
  ) {
    return yield* withCheckout(input.source, input.ref, (checkout, commit, only) =>
      Effect.gen(function* () {
        const parsed = parseSkillSource(input.source);
        const skills = (yield* discoverSkills(
          checkout,
          repositoryNameOf(parsed?.url ?? input.source),
        )).filter((skill) => only === undefined || skill.id === only || skill.name === only);
        if (skills.length === 0) {
          return yield* fail(
            "not_found",
            "No skills (folders with a SKILL.md) were found in that source.",
          );
        }
        const described = yield* Effect.forEach(skills, (skill) =>
          exists(libraryFolder(skill.id)).pipe(
            Effect.map((installed) => ({
              path: skill.path,
              id: skill.id,
              name: skill.name,
              ...(skill.description === undefined ? {} : { description: skill.description }),
              installed,
            })),
          ),
        );
        return { commit, skills: described };
      }),
    );
  });

  const copyTree = Effect.fn("SkillLibraryService.copyTree")(function* (
    from: string,
    to: string,
    budget: { files: number; bytes: number },
  ): Effect.fn.Return<void, SkillLibraryError> {
    yield* fileSystem.makeDirectory(to, { recursive: true }).pipe(io("Could not stage the skill"));
    const names = yield* fileSystem.readDirectory(from).pipe(io("Could not read the skill"));
    for (const name of names) {
      if (name === ".git") continue;
      const source = path.join(from, name);
      const target = path.join(to, name);
      // Links are skipped: a skill is copied as files only.
      if (Option.isSome(yield* fileSystem.readLink(source).pipe(Effect.option))) continue;
      const info = yield* fileSystem.stat(source).pipe(io("Could not read the skill"));
      if (info.type === "Directory") {
        yield* copyTree(source, target, budget);
        continue;
      }
      if (info.type !== "File") continue;
      budget.files += 1;
      budget.bytes += Number(info.size);
      if (budget.files > MAX_COPY_FILES || budget.bytes > MAX_COPY_BYTES) {
        return yield* fail("limit", "That skill is larger than 2000 files or 20 MB.");
      }
      yield* fileSystem.copyFile(source, target).pipe(io("Could not copy the skill"));
    }
  });

  /** Puts one skill from a checkout into the library; a same-named one goes to the trash first. */
  const installFromCheckout = Effect.fn("SkillLibraryService.installFromCheckout")(
    function* (input: {
      readonly checkout: string;
      readonly relativePath: string;
      readonly id: string;
      readonly replace: boolean;
      readonly source: SkillLibrarySource;
    }) {
      yield* requireId(input.id);
      const staged = path.join(stagingDirectory, `install-${yield* randomSuffix}`);
      return yield* Effect.gen(function* () {
        yield* copyTree(path.join(input.checkout, input.relativePath), staged, {
          files: 0,
          bytes: 0,
        });
        yield* mutations.withPermits(1)(
          Effect.gen(function* () {
            const folder = libraryFolder(input.id);
            if (yield* exists(folder)) {
              if (!input.replace) return yield* fail("conflict", "Already installed.");
              // Links keep working: the new folder takes the old one's place.
              yield* trashSkill(input.id, false);
            }
            yield* fileSystem
              .makeDirectory(libraryPath, { recursive: true })
              .pipe(io("Could not create the library"));
            yield* fileSystem.rename(staged, folder).pipe(io("Could not install the skill"));
            yield* updateLock((skills) => {
              skills[input.id] = input.source;
            });
          }),
        );
      }).pipe(
        Effect.ensuring(
          fileSystem.remove(staged, { recursive: true, force: true }).pipe(Effect.ignore),
        ),
      );
    },
  );

  const install = Effect.fn("SkillLibraryService.install")(function* (
    input: SkillLibraryInstallInput,
  ) {
    return yield* withCheckout(input.source, input.ref, (checkout, commit) =>
      Effect.gen(function* () {
        const parsed = parseSkillSource(input.source);
        const available = yield* discoverSkills(
          checkout,
          repositoryNameOf(parsed?.url ?? input.source),
        );
        const installedAt = yield* now;
        const installed: string[] = [];
        const skipped: Array<{ path: string; reason: string }> = [];
        for (const relativePath of new Set(input.paths)) {
          const skill = available.find((candidate) => candidate.path === relativePath);
          if (skill === undefined) {
            skipped.push({ path: relativePath, reason: "Not found in that source." });
            continue;
          }
          const result = yield* installFromCheckout({
            checkout,
            relativePath,
            id: skill.id,
            replace: input.replace === true,
            source: {
              source: input.source,
              ...(input.ref === undefined ? {} : { ref: input.ref }),
              commit,
              path: relativePath,
              installedAt,
            },
          }).pipe(Effect.result);
          if (result._tag === "Success") installed.push(skill.id);
          else skipped.push({ path: relativePath, reason: result.failure.message });
        }
        return { commit, installed, skipped };
      }),
    );
  });

  const update = Effect.fn("SkillLibraryService.update")(function* (
    input: SkillLibraryUpdateInput,
  ) {
    yield* requireFolder(input.id);
    const entry = (yield* readLock).skills[input.id];
    if (entry === undefined) {
      return yield* fail(
        "invalid",
        "This skill was not installed from a source, so there is nothing to update.",
      );
    }
    return yield* withCheckout(entry.source, entry.ref, (checkout, commit) =>
      Effect.gen(function* () {
        if (commit === entry.commit) return { status: "current" as const };
        if (!(yield* exists(path.join(checkout, entry.path, "SKILL.md")))) {
          return yield* fail("not_found", "The skill is no longer in its source.");
        }
        yield* installFromCheckout({
          checkout,
          relativePath: entry.path,
          id: input.id,
          replace: true,
          source: { ...entry, commit, installedAt: yield* now },
        });
        return { status: "updated" as const };
      }),
    );
  });

  // "Claude uses only the library's skills": the names each Claude instance may load, which are the
  // library skills linked for it. Published for the adapter, which builds session options synchronously.
  const publishPolicy = Effect.fn("SkillLibraryService.publishPolicy")(function* () {
    const settings = (yield* readLock).settings ?? DEFAULT_SKILL_LIBRARY_SETTINGS;
    const allowed = new Map<string, ReadonlyArray<string>>();
    if (settings.claudeLibraryOnly) {
      const names = yield* fileSystem
        .readDirectory(libraryPath)
        .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
      for (const target of yield* resolveTargets()) {
        if (String(target.driver) !== "claudeAgent") continue;
        const linked: string[] = [];
        for (const id of names.filter(isSafeFolderId)) {
          if ((yield* providerState(target, id)) === "linked") linked.push(id);
        }
        allowed.set(target.instanceId, linked);
      }
    }
    setClaudeSkillAllowlistSource((instanceId) => allowed.get(instanceId));
  });
  const publishPolicyQuietly = publishPolicy().pipe(Effect.ignore);
  const publishing =
    <Args extends ReadonlyArray<unknown>, A, E, R>(
      run: (...args: Args) => Effect.Effect<A, E, R>,
    ) =>
    (...args: Args) =>
      run(...args).pipe(Effect.tap(() => publishPolicyQuietly));
  // A change to the library or the setting: every provider's menu may list something else now.
  const changing =
    <Args extends ReadonlyArray<unknown>, A, E, R>(
      run: (...args: Args) => Effect.Effect<A, E, R>,
    ) =>
    (...args: Args) =>
      run(...args).pipe(
        Effect.tap(() => publishPolicyQuietly),
        Effect.tap(() =>
          resolveTargets().pipe(
            Effect.flatMap((targets) =>
              Effect.forEach(
                targets.filter((target) => target.mode !== "none"),
                (target) => refreshProvider(target.instanceId),
                { discard: true },
              ),
            ),
            Effect.ignore,
          ),
        ),
      );

  const setSettings = Effect.fn("SkillLibraryService.setSettings")(function* (
    input: SkillLibrarySetSettingsInput,
  ) {
    return yield* mutations.withPermits(1)(
      Effect.gen(function* () {
        const lock = yield* readLock;
        const settings = {
          ...(lock.settings ?? DEFAULT_SKILL_LIBRARY_SETTINGS),
          ...(input.claudeLibraryOnly === undefined
            ? {}
            : { claudeLibraryOnly: input.claudeLibraryOnly }),
        };
        yield* writeLock({ ...lock, settings });
        return { settings };
      }),
    );
  });

  // Skill folders a provider keeps in its own folder: real folders with a SKILL.md, not links (those
  // came from the library) and not the folders the provider manages itself, which have no SKILL.md.
  const scanImport = Effect.fn("SkillLibraryService.scanImport")(function* () {
    const candidates: SkillLibraryImportCandidate[] = [];
    for (const target of yield* resolveTargets()) {
      if (target.linkDirectory === undefined) continue;
      const names = yield* fileSystem
        .readDirectory(target.linkDirectory)
        .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
      for (const id of names.filter(isSafeFolderId).toSorted((a, b) => a.localeCompare(b))) {
        if (candidates.length >= MAX_IMPORT_CANDIDATES) break;
        const folder = path.join(target.linkDirectory, id);
        if (Option.isSome(yield* fileSystem.readLink(folder).pipe(Effect.option))) continue;
        const info = yield* fileSystem.stat(folder).pipe(Effect.option);
        if (Option.isNone(info) || info.value.type !== "Directory") continue;
        const file = yield* readSkillFileOption(folder);
        if (Option.isNone(file) || file.value.text === undefined) continue;
        const frontmatter = parseSkillFrontmatter(file.value.text);
        const inLibrary =
          (yield* exists(libraryFolder(id))) ||
          Option.isSome(yield* fileSystem.readLink(libraryFolder(id)).pipe(Effect.option));
        candidates.push({
          instanceId: target.instanceId,
          id,
          name: frontmatter?.name ?? id,
          ...(frontmatter?.description === undefined
            ? {}
            : { description: frontmatter.description }),
          path: folder,
          inLibrary,
        });
      }
    }
    return { candidates };
  });

  const importOne = Effect.fn("SkillLibraryService.importOne")(function* (
    target: SkillLibraryTarget & { readonly linkDirectory: string },
    id: string,
    mode: SkillLibraryImportInput["mode"],
  ) {
    yield* requireId(id);
    const source = path.join(target.linkDirectory, id);
    if (Option.isSome(yield* fileSystem.readLink(source).pipe(Effect.option))) {
      return yield* fail("invalid", "It is a link already, not a folder of the provider's own.");
    }
    const info = yield* fileSystem.stat(source).pipe(Effect.option);
    if (Option.isNone(info) || info.value.type !== "Directory") {
      return yield* fail("not_found", "There is no such folder.");
    }
    if (!(yield* exists(path.join(source, "SKILL.md")))) {
      return yield* fail("invalid", "It has no SKILL.md.");
    }
    const folder = libraryFolder(id);
    const taken = Effect.gen(function* () {
      return (
        (yield* exists(folder)) ||
        Option.isSome(yield* fileSystem.readLink(folder).pipe(Effect.option))
      );
    });
    if (yield* taken) return yield* fail("conflict", "The library has a skill with this name.");
    const intoLibrary = (move: Effect.Effect<void, SkillLibraryError>) =>
      mutations.withPermits(1)(
        Effect.gen(function* () {
          if (yield* taken)
            return yield* fail("conflict", "The library has a skill with this name.");
          yield* fileSystem
            .makeDirectory(libraryPath, { recursive: true })
            .pipe(io("Could not create the library"));
          yield* move;
        }),
      );
    if (mode === "move") {
      yield* intoLibrary(
        fileSystem
          .rename(source, folder)
          .pipe(
            Effect.mapError((cause) =>
              fail(
                "unavailable",
                `Could not move it (both folders must be on the same disk; copy it instead): ${cause.message}`,
              ),
            ),
          ),
      );
      yield* createLink(target, id);
      yield* refreshProvider(target.instanceId);
      return;
    }
    const staged = path.join(stagingDirectory, `import-${yield* randomSuffix}`);
    yield* copyTree(source, staged, { files: 0, bytes: 0 }).pipe(
      Effect.andThen(
        intoLibrary(fileSystem.rename(staged, folder).pipe(io("Could not import the skill"))),
      ),
      Effect.ensuring(
        fileSystem.remove(staged, { recursive: true, force: true }).pipe(Effect.ignore),
      ),
    );
  });

  const importSkills = Effect.fn("SkillLibraryService.importSkills")(function* (
    input: SkillLibraryImportInput,
  ) {
    const target = (yield* resolveTargets()).find(
      (candidate) => candidate.instanceId === input.instanceId,
    );
    if (target === undefined || target.linkDirectory === undefined) {
      return yield* fail(
        "invalid",
        "That provider has no skills folder of its own to import from.",
      );
    }
    const importable = { ...target, linkDirectory: target.linkDirectory };
    const imported: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const id of new Set(input.ids)) {
      const outcome = yield* importOne(importable, id, input.mode).pipe(Effect.result);
      if (outcome._tag === "Success") imported.push(id);
      else skipped.push({ id, reason: outcome.failure.message });
    }
    return { imported, skipped };
  });

  yield* publishPolicyQuietly;

  return SkillLibraryService.of({
    list: publishing(list),
    read,
    write: changing(write),
    remove: changing(remove),
    restore: changing(restore),
    setLink: changing(setLink),
    inspectSource,
    install: changing(install),
    update: changing(update),
    setSettings: changing(setSettings),
    scanImport,
    importSkills: changing(importSkills),
  });
});

export const layer = Layer.effect(SkillLibraryService, make);
