import { ProviderInstanceId, ServerSettings } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { resolveMcpServers } from "./resolveMcpServers.ts";

const decodeSettings = Schema.decodeUnknownSync(ServerSettings);
const settings = (mcpServers: ReadonlyArray<unknown>) => decodeSettings({ mcpServers });

const claude = ProviderInstanceId.make("claudeAgent");
const opencode = ProviderInstanceId.make("opencode");

describe("resolveMcpServers", () => {
  const hub = {
    name: "hub",
    transport: "http",
    url: "https://hub.example/mcp/$smart/code",
    headers: { Authorization: "Bearer hub-key", "X-Empty": "" },
  };

  it("keeps enabled servers for the instance, all instances when none is chosen", () => {
    const all = settings([
      hub,
      { ...hub, name: "off", enabled: false },
      { ...hub, name: "claude-only", providerInstanceIds: ["claudeAgent"] },
    ]);
    expect(resolveMcpServers(all, claude).map((server) => server.name)).toEqual([
      "hub",
      "claude-only",
    ]);
    expect(resolveMcpServers(all, opencode).map((server) => server.name)).toEqual(["hub"]);
  });

  it("drops a header or env value the secret store could not give back", () => {
    const [server] = resolveMcpServers(settings([hub]), claude);
    expect(server).toMatchObject({ headers: { Authorization: "Bearer hub-key" }, trusted: false });
    expect(server && "headers" in server ? Object.keys(server.headers) : []).toEqual([
      "Authorization",
    ]);
    const [stdio] = resolveMcpServers(
      settings([{ name: "local", transport: "stdio", command: "npx", env: { A: "1", B: "" } }]),
      claude,
    );
    expect(stdio).toMatchObject({ transport: "stdio", command: "npx", args: [], env: { A: "1" } });
  });

  it("refuses T3's own names and duplicates", () => {
    const decode = (servers: ReadonlyArray<unknown>) => () => settings(servers);
    expect(decode([{ ...hub, name: "t3-code" }])).toThrow();
    expect(decode([{ ...hub, name: "t3-code-direct" }])).toThrow();
    expect(decode([hub, hub])).toThrow();
    expect(decode([{ ...hub, name: "has space" }])).toThrow();
    expect(decode([{ ...hub, url: "ftp://nope" }])).toThrow();
  });
});
