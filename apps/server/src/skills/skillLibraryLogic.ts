import { SKILL_NAME_MAX_CHARS, SKILL_NAME_PATTERN } from "@t3tools/contracts";
import { parse as parseYamlDocument } from "yaml";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A folder the library, a trash entry or a provider folder may hold: one plain path segment. */
export function isSafeFolderId(id: string): boolean {
  return (
    id.length > 0 &&
    id.length <= 128 &&
    id !== "." &&
    id !== ".." &&
    !id.startsWith(".") &&
    !/[\\/\0]/.test(id)
  );
}

/** The stricter name the Agent Skills specification allows; used for skills made here. */
export function isSpecSkillName(name: string): boolean {
  return name.length <= SKILL_NAME_MAX_CHARS && SKILL_NAME_PATTERN.test(name);
}

export interface SkillFrontmatter {
  readonly name?: string;
  readonly description?: string;
}

/** `undefined` when the text has no frontmatter block or it is not valid YAML. */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | undefined {
  const match = FRONTMATTER_PATTERN.exec(content.replace(/^﻿/, ""));
  if (!match) return undefined;
  let parsed: unknown;
  try {
    parsed = parseYamlDocument(match[1] ?? "");
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const record = parsed as Record<string, unknown>;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  const name = text(record.name);
  const description = text(record.description);
  return {
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
  };
}

export interface ParsedSkillSource {
  /** What `git fetch` gets. */
  readonly url: string;
  /** From `owner/repo@skill`: only this skill is wanted. */
  readonly only?: string;
}

const SHORTHAND_PATTERN =
  /^([A-Za-z0-9][A-Za-z0-9_.-]*)\/([A-Za-z0-9][A-Za-z0-9_.-]*?)(?:\.git)?(?:@([A-Za-z0-9][A-Za-z0-9_.-]*))?$/;
const HTTPS_PATTERN = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[^\s]*$/;
const SCP_PATTERN = /^[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:[A-Za-z0-9_./~-]+$/;
const SSH_PATTERN = /^ssh:\/\/[A-Za-z0-9_.-]+@?[A-Za-z0-9.-]+(?::\d+)?\/[^\s]*$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function isValidGitRef(ref: string): boolean {
  return REF_PATTERN.test(ref) && !ref.includes("..");
}

/**
 * `owner/repo` is GitHub. Anything else must be an https, ssh or scp-style URL: a local path,
 * `file:` or `ext::` would let a request read the server's own disk, and a leading dash would
 * be read by git as an option.
 */
export function parseSkillSource(source: string): ParsedSkillSource | undefined {
  const value = source.trim();
  if (value.length === 0 || value.startsWith("-") || /\s/.test(value)) return undefined;
  if (HTTPS_PATTERN.test(value) || SSH_PATTERN.test(value) || SCP_PATTERN.test(value)) {
    return { url: value };
  }
  const shorthand = SHORTHAND_PATTERN.exec(value);
  if (shorthand && !value.includes("://") && !value.includes(":")) {
    const [, owner, repo, only] = shorthand;
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      ...(only === undefined ? {} : { only }),
    };
  }
  return undefined;
}

/** The id a skill from a repository gets in the library: its spec name, else its folder name. */
export function skillIdForSource(input: {
  readonly folderName: string;
  readonly frontmatterName: string | undefined;
}): string | undefined {
  if (input.frontmatterName !== undefined && isSpecSkillName(input.frontmatterName)) {
    return input.frontmatterName;
  }
  return isSafeFolderId(input.folderName) ? input.folderName : undefined;
}

/** Sorts before any later one, so a listing of the trash is newest first by reading backwards. */
export function trashIdFor(deletedAtIso: string, suffix: string): string {
  return `${deletedAtIso.replace(/\D/g, "").slice(0, 14)}-${suffix}`;
}

export const TRASH_ID_PATTERN = /^\d{14}-[a-f0-9]{6}$/;
