import * as Schema from "effect/Schema";

import { IsoDateTime } from "./baseSchemas.ts";
import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";

/** The folder name of a skill in the library; `name` in its `SKILL.md` normally equals it. */
export const SkillLibraryId = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(128));
export type SkillLibraryId = typeof SkillLibraryId.Type;

/** The Agent Skills specification's name: lowercase letters, digits and single hyphens. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILL_NAME_MAX_CHARS = 64;
export const SKILL_FILE_MAX_BYTES = 256 * 1024;

/**
 * `native`: the provider reads the library folder itself. `link`: it reads its own folder, so
 * a skill is reached through a symlink there. `none`: this provider has no skills to manage.
 */
export const SkillLibraryTargetMode = Schema.Literals(["native", "link", "none"]);
export type SkillLibraryTargetMode = typeof SkillLibraryTargetMode.Type;

export const SkillLibraryTarget = Schema.Struct({
  instanceId: ProviderInstanceId,
  driver: ProviderDriverKind,
  displayName: Schema.String,
  mode: SkillLibraryTargetMode,
  /** Where links for this provider go; set only when `mode` is `link`. */
  linkDirectory: Schema.optional(Schema.String),
});
export type SkillLibraryTarget = typeof SkillLibraryTarget.Type;

/**
 * `native` and `linked` mean the provider gets the skill. `missing`: it could, with a link.
 * `blocked`: something else already uses the name in the provider's folder. `unsupported`:
 * the provider has no folder to link into.
 */
export const SkillLibraryProviderState = Schema.Literals([
  "native",
  "linked",
  "missing",
  "blocked",
  "unsupported",
]);
export type SkillLibraryProviderState = typeof SkillLibraryProviderState.Type;

export const SkillLibrarySource = Schema.Struct({
  /** What was typed: `owner/repo`, or a git URL. */
  source: Schema.String,
  ref: Schema.optional(Schema.String),
  commit: Schema.String,
  /** The skill's folder inside the repository; empty for the repository root. */
  path: Schema.String,
  installedAt: IsoDateTime,
});
export type SkillLibrarySource = typeof SkillLibrarySource.Type;

export const SkillLibrarySkill = Schema.Struct({
  id: SkillLibraryId,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  path: Schema.String,
  /** Set when the folder is not a usable skill, for example it has no `SKILL.md`. */
  problem: Schema.optional(Schema.String),
  modifiedAt: IsoDateTime,
  source: Schema.optional(SkillLibrarySource),
  providers: Schema.Array(
    Schema.Struct({ instanceId: ProviderInstanceId, state: SkillLibraryProviderState }),
  ),
});
export type SkillLibrarySkill = typeof SkillLibrarySkill.Type;

export const SkillLibraryTrashEntry = Schema.Struct({
  id: Schema.String,
  skillId: SkillLibraryId,
  deletedAt: IsoDateTime,
});
export type SkillLibraryTrashEntry = typeof SkillLibraryTrashEntry.Type;

export const SkillLibraryListInput = Schema.Struct({});
export type SkillLibraryListInput = typeof SkillLibraryListInput.Type;

export const SkillLibrarySettings = Schema.Struct({
  /**
   * New Claude sessions load only the skills the library links into Claude's folder, so Claude's
   * own, plugin and built-in skills are not offered to the model. Other providers are untouched.
   */
  claudeLibraryOnly: Schema.Boolean,
});
export type SkillLibrarySettings = typeof SkillLibrarySettings.Type;

export const DEFAULT_SKILL_LIBRARY_SETTINGS: SkillLibrarySettings = { claudeLibraryOnly: false };

export const SkillLibraryListResult = Schema.Struct({
  libraryPath: Schema.String,
  skills: Schema.Array(SkillLibrarySkill),
  targets: Schema.Array(SkillLibraryTarget),
  trash: Schema.Array(SkillLibraryTrashEntry),
  settings: SkillLibrarySettings,
});
export type SkillLibraryListResult = typeof SkillLibraryListResult.Type;

export const SkillLibraryReadInput = Schema.Struct({ id: SkillLibraryId });
export type SkillLibraryReadInput = typeof SkillLibraryReadInput.Type;

export const SkillLibraryReadResult = Schema.Struct({
  id: SkillLibraryId,
  content: Schema.String,
  /** Paths inside the skill folder, relative to it, capped; `SKILL.md` is not listed. */
  files: Schema.Array(Schema.String),
  filesTruncated: Schema.Boolean,
});
export type SkillLibraryReadResult = typeof SkillLibraryReadResult.Type;

/** `create` makes the folder and fails if it exists; `replace` rewrites `SKILL.md` of an existing one. */
export const SkillLibraryWriteInput = Schema.Struct({
  id: SkillLibraryId,
  mode: Schema.Literals(["create", "replace"]),
  content: Schema.String.check(Schema.isMaxLength(SKILL_FILE_MAX_BYTES)),
});
export type SkillLibraryWriteInput = typeof SkillLibraryWriteInput.Type;

export const SkillLibraryWriteResult = Schema.Struct({ id: SkillLibraryId });
export type SkillLibraryWriteResult = typeof SkillLibraryWriteResult.Type;

export const SkillLibraryRemoveInput = Schema.Struct({ id: SkillLibraryId });
export type SkillLibraryRemoveInput = typeof SkillLibraryRemoveInput.Type;

export const SkillLibraryRemoveResult = Schema.Struct({ trashId: Schema.String });
export type SkillLibraryRemoveResult = typeof SkillLibraryRemoveResult.Type;

export const SkillLibraryRestoreInput = Schema.Struct({ trashId: Schema.String });
export type SkillLibraryRestoreInput = typeof SkillLibraryRestoreInput.Type;

export const SkillLibraryRestoreResult = Schema.Struct({ id: SkillLibraryId });
export type SkillLibraryRestoreResult = typeof SkillLibraryRestoreResult.Type;

export const SkillLibrarySetLinkInput = Schema.Struct({
  id: SkillLibraryId,
  instanceId: ProviderInstanceId,
  linked: Schema.Boolean,
});
export type SkillLibrarySetLinkInput = typeof SkillLibrarySetLinkInput.Type;

export const SkillLibrarySetLinkResult = Schema.Struct({ state: SkillLibraryProviderState });
export type SkillLibrarySetLinkResult = typeof SkillLibrarySetLinkResult.Type;

/** `source` is `owner/repo` (GitHub), a git URL, or `owner/repo@skill` to pick one skill. */
export const SkillLibraryInspectSourceInput = Schema.Struct({
  source: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(512)),
  ref: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
});
export type SkillLibraryInspectSourceInput = typeof SkillLibraryInspectSourceInput.Type;

export const SkillLibrarySourceSkill = Schema.Struct({
  /** The folder inside the repository. */
  path: Schema.String,
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  /** The library already has a skill with this id. */
  installed: Schema.Boolean,
});
export type SkillLibrarySourceSkill = typeof SkillLibrarySourceSkill.Type;

export const SkillLibraryInspectSourceResult = Schema.Struct({
  commit: Schema.String,
  skills: Schema.Array(SkillLibrarySourceSkill),
});
export type SkillLibraryInspectSourceResult = typeof SkillLibraryInspectSourceResult.Type;

export const SkillLibraryInstallInput = Schema.Struct({
  source: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(512)),
  ref: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
  /** Folders inside the repository, as `inspectSource` listed them. */
  paths: Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  /** Replace a skill with the same id; the old one goes to the trash. */
  replace: Schema.optional(Schema.Boolean),
});
export type SkillLibraryInstallInput = typeof SkillLibraryInstallInput.Type;

export const SkillLibraryInstallResult = Schema.Struct({
  commit: Schema.String,
  installed: Schema.Array(SkillLibraryId),
  skipped: Schema.Array(Schema.Struct({ path: Schema.String, reason: Schema.String })),
});
export type SkillLibraryInstallResult = typeof SkillLibraryInstallResult.Type;

export const SkillLibraryUpdateInput = Schema.Struct({ id: SkillLibraryId });
export type SkillLibraryUpdateInput = typeof SkillLibraryUpdateInput.Type;

export const SkillLibraryUpdateResult = Schema.Struct({
  status: Schema.Literals(["updated", "current"]),
});
export type SkillLibraryUpdateResult = typeof SkillLibraryUpdateResult.Type;

export const SkillLibrarySetSettingsInput = Schema.Struct({
  claudeLibraryOnly: Schema.optional(Schema.Boolean),
});
export type SkillLibrarySetSettingsInput = typeof SkillLibrarySetSettingsInput.Type;

export const SkillLibrarySetSettingsResult = Schema.Struct({ settings: SkillLibrarySettings });
export type SkillLibrarySetSettingsResult = typeof SkillLibrarySetSettingsResult.Type;

export const SkillLibraryImportScanInput = Schema.Struct({});
export type SkillLibraryImportScanInput = typeof SkillLibraryImportScanInput.Type;

/** A skill folder a provider keeps in its own skills folder, as a real folder rather than a link. */
export const SkillLibraryImportCandidate = Schema.Struct({
  instanceId: ProviderInstanceId,
  id: SkillLibraryId,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  path: Schema.String,
  /** The library already has a skill with this id, so importing it is refused. */
  inLibrary: Schema.Boolean,
});
export type SkillLibraryImportCandidate = typeof SkillLibraryImportCandidate.Type;

export const SkillLibraryImportScanResult = Schema.Struct({
  candidates: Schema.Array(SkillLibraryImportCandidate),
});
export type SkillLibraryImportScanResult = typeof SkillLibraryImportScanResult.Type;

/**
 * `copy` leaves the provider's folder as it is. `move` replaces it with a link into the library,
 * so the provider keeps the skill and its files live in one place.
 */
export const SkillLibraryImportInput = Schema.Struct({
  instanceId: ProviderInstanceId,
  ids: Schema.Array(SkillLibraryId).check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  mode: Schema.Literals(["copy", "move"]),
});
export type SkillLibraryImportInput = typeof SkillLibraryImportInput.Type;

export const SkillLibraryImportResult = Schema.Struct({
  imported: Schema.Array(SkillLibraryId),
  skipped: Schema.Array(Schema.Struct({ id: Schema.String, reason: Schema.String })),
});
export type SkillLibraryImportResult = typeof SkillLibraryImportResult.Type;

export class SkillLibraryError extends Schema.TaggedError<SkillLibraryError>()(
  "SkillLibraryError",
  {
    code: Schema.Literals(["invalid", "not_found", "conflict", "unavailable", "limit"]),
    message: Schema.String,
  },
) {}
