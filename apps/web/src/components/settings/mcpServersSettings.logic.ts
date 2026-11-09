import { McpServerConfig, McpServerName } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

export interface McpPair {
  /** Stable while the row is edited or others are removed, so inputs keep their focus. */
  readonly id: number;
  readonly key: string;
  readonly value: string;
}

let nextPairId = 0;
export const newMcpPair = (key = "", value = ""): McpPair => ({ id: nextPairId++, key, value });

/** What the editor holds; text fields stay strings until `serverFromDraft` checks them. */
export interface McpServerDraft {
  readonly name: string;
  readonly transport: "http" | "stdio";
  readonly enabled: boolean;
  readonly trusted: boolean;
  /** Empty means every provider instance. */
  readonly providerInstanceIds: ReadonlyArray<string>;
  readonly url: string;
  readonly headers: ReadonlyArray<McpPair>;
  readonly command: string;
  /** One argument per line. */
  readonly args: string;
  readonly env: ReadonlyArray<McpPair>;
}

export const emptyMcpServerDraft = (transport: "http" | "stdio" = "http"): McpServerDraft => ({
  name: "",
  transport,
  enabled: true,
  trusted: false,
  providerInstanceIds: [],
  url: "",
  headers: [],
  command: "",
  args: "",
  env: [],
});

const pairs = (values: Readonly<Record<string, string>>): ReadonlyArray<McpPair> =>
  Object.entries(values).map(([key, value]) => newMcpPair(key, value));

export function draftFromMcpServer(server: McpServerConfig): McpServerDraft {
  const base = {
    ...emptyMcpServerDraft(server.transport),
    name: server.name,
    enabled: server.enabled,
    trusted: server.trusted,
    providerInstanceIds: server.providerInstanceIds,
  };
  return server.transport === "http"
    ? { ...base, url: server.url, headers: pairs(server.headers) }
    : { ...base, command: server.command, args: server.args.join("\n"), env: pairs(server.env) };
}

const record = (values: ReadonlyArray<McpPair>): Record<string, string> =>
  Object.fromEntries(
    values.flatMap(({ key, value }) => (key.trim() === "" ? [] : [[key.trim(), value] as const])),
  );

export function mcpServerFromDraft(draft: McpServerDraft): McpServerConfig {
  const shared = {
    name: draft.name.trim(),
    enabled: draft.enabled,
    trusted: draft.trusted,
    providerInstanceIds: draft.providerInstanceIds,
  } as const;
  return draft.transport === "http"
    ? ({
        ...shared,
        transport: "http",
        url: draft.url.trim(),
        headers: record(draft.headers),
      } as McpServerConfig)
    : ({
        ...shared,
        transport: "stdio",
        command: draft.command.trim(),
        args: draft.args.split("\n").flatMap((line) => (line.trim() === "" ? [] : [line.trim()])),
        env: record(draft.env),
      } as McpServerConfig);
}

const decodeName = Schema.decodeUnknownExit(McpServerName);
const decodeServer = Schema.decodeUnknownExit(McpServerConfig);

/** The first problem a save would hit, in the words a form shows; null when it would pass. */
export function validateMcpServerDraft(
  draft: McpServerDraft,
  otherNames: ReadonlyArray<string>,
): string | null {
  if (draft.name.trim() === "") return "Give the server a name.";
  if (decodeName(draft.name.trim())._tag === "Failure") {
    return draft.name.trim().toLowerCase().startsWith("t3-code")
      ? "Names starting with t3-code are reserved."
      : "Use letters, digits, _ and - only, up to 64 characters.";
  }
  if (otherNames.includes(draft.name.trim())) return "Another server has this name.";
  if (draft.transport === "http" && !/^https?:\/\/\S+$/.test(draft.url.trim())) {
    return "Enter a URL starting with http:// or https://.";
  }
  if (draft.transport === "stdio" && draft.command.trim() === "") return "Enter the command.";
  return decodeServer(mcpServerFromDraft(draft))._tag === "Failure"
    ? "Check the fields: the server is not valid."
    : null;
}

export interface McpImportResult {
  readonly servers: ReadonlyArray<McpServerConfig>;
  readonly skipped: ReadonlyArray<string>;
  readonly error: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringRecord = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) =>
          typeof item === "string" ? [[key, item] as const] : [],
        ),
      )
    : {};

/**
 * Reads the `mcpServers` shape Claude Code, Cursor and most clients share: `{ "mcpServers": { name: ... } }`
 * or the inner map. A server with a `url` is remote, one with a `command` is stdio.
 */
export function parseMcpServersJson(text: string, taken: ReadonlyArray<string>): McpImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { servers: [], skipped: [], error: "That is not valid JSON." };
  }
  const map = isRecord(parsed) && isRecord(parsed.mcpServers) ? parsed.mcpServers : parsed;
  if (!isRecord(map) || Object.keys(map).length === 0) {
    return { servers: [], skipped: [], error: "Expected an object of servers, like mcpServers." };
  }
  const servers: McpServerConfig[] = [];
  const skipped: string[] = [];
  const names = new Set(taken);
  for (const [name, raw] of Object.entries(map)) {
    if (!isRecord(raw) || names.has(name) || decodeName(name)._tag === "Failure") {
      skipped.push(name);
      continue;
    }
    const base = { name, enabled: true, trusted: false, providerInstanceIds: [] } as const;
    const candidate =
      typeof raw.url === "string" && raw.type !== "sse"
        ? { ...base, transport: "http", url: raw.url, headers: stringRecord(raw.headers) }
        : typeof raw.command === "string"
          ? {
              ...base,
              transport: "stdio",
              command: raw.command,
              args: Array.isArray(raw.args)
                ? raw.args.filter((arg): arg is string => typeof arg === "string")
                : [],
              env: stringRecord(raw.env),
            }
          : null;
    const decoded = candidate === null ? null : decodeServer(candidate);
    if (decoded === null || decoded._tag === "Failure") {
      skipped.push(name);
      continue;
    }
    servers.push(decoded.value);
    names.add(name);
  }
  return {
    servers,
    skipped,
    error: servers.length === 0 ? "No server could be imported." : null,
  };
}
