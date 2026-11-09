import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderInstanceId } from "./providerInstance.ts";

// Shape adapted from E4 Code's `mcpServer.ts` (MIT), without OAuth.

/** The name T3 Code's own MCP server is registered under in every provider. */
const T3_MCP_SERVER_NAME = "t3-code";

// The name becomes Claude's `mcp__<name>__` prefix, a Codex config key and an OpenCode server name.
export const McpServerName = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-zA-Z0-9_-]+$/),
  Schema.makeFilter(
    (name) =>
      (name !== T3_MCP_SERVER_NAME && !name.startsWith(`${T3_MCP_SERVER_NAME}-`)) ||
      `${name} is reserved for T3 Code.`,
  ),
);
export type McpServerName = typeof McpServerName.Type;

// Header and environment values are kept in the secret store; settingsSecrets.ts maps them.
const McpServerSecretMap = Schema.Record(Schema.String, Schema.String).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed({})),
);

const sharedFields = {
  name: McpServerName,
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  /** The provider instances whose sessions get this server; empty means every instance. */
  providerInstanceIds: Schema.Array(ProviderInstanceId).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  /** Allow the server's tools without asking, where the provider can express that. */
  trusted: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
};

export const McpStdioServerConfig = Schema.Struct({
  ...sharedFields,
  transport: Schema.Literal("stdio"),
  command: TrimmedNonEmptyString,
  args: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  env: McpServerSecretMap,
});
export type McpStdioServerConfig = typeof McpStdioServerConfig.Type;

export const McpHttpServerConfig = Schema.Struct({
  ...sharedFields,
  transport: Schema.Literal("http"),
  url: TrimmedNonEmptyString.check(Schema.isPattern(/^https?:\/\/\S+$/)),
  headers: McpServerSecretMap,
});
export type McpHttpServerConfig = typeof McpHttpServerConfig.Type;

export const McpServerConfig = Schema.Union([McpStdioServerConfig, McpHttpServerConfig]);
export type McpServerConfig = typeof McpServerConfig.Type;

export const McpServerConfigs = Schema.Array(McpServerConfig).check(
  Schema.makeFilter(
    (servers: ReadonlyArray<{ readonly name: string }>) =>
      new Set(servers.map((server) => server.name)).size === servers.length ||
      "MCP server names must be unique.",
  ),
);

/** A server resolved for one session: secrets are real values, never redacted placeholders. */
export type ResolvedMcpServer =
  | {
      readonly transport: "http";
      readonly name: string;
      readonly url: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly trusted: boolean;
    }
  | {
      readonly transport: "stdio";
      readonly name: string;
      readonly command: string;
      readonly args: ReadonlyArray<string>;
      readonly env: Readonly<Record<string, string>>;
      readonly trusted: boolean;
    };
