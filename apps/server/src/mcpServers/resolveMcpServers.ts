import type {
  McpServerConfig,
  ProviderInstanceId,
  ResolvedMcpServer,
  ServerSettings,
} from "@t3tools/contracts";

const withValues = (values: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value.length > 0));

const resolveServer = (server: McpServerConfig): ResolvedMcpServer =>
  server.transport === "http"
    ? {
        transport: "http",
        name: server.name,
        url: server.url,
        // A secret the store could not read comes back empty; a blank header is worse than none.
        headers: withValues(server.headers),
        trusted: server.trusted,
      }
    : {
        transport: "stdio",
        name: server.name,
        command: server.command,
        args: server.args,
        env: withValues(server.env),
        trusted: server.trusted,
      };

/** The enabled servers one provider instance's sessions get, from settings whose secrets are materialized. */
export function resolveMcpServers(
  settings: Pick<ServerSettings, "mcpServers">,
  providerInstanceId: ProviderInstanceId,
): ReadonlyArray<ResolvedMcpServer> {
  return settings.mcpServers
    .filter(
      (server) =>
        server.enabled &&
        (server.providerInstanceIds.length === 0 ||
          server.providerInstanceIds.includes(providerInstanceId)),
    )
    .map(resolveServer);
}
