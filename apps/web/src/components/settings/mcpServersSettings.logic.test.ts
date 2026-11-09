import { describe, expect, it } from "vite-plus/test";

import {
  draftFromMcpServer,
  emptyMcpServerDraft,
  mcpServerFromDraft,
  newMcpPair,
  parseMcpServersJson,
  validateMcpServerDraft,
} from "./mcpServersSettings.logic";

const hubDraft = {
  ...emptyMcpServerDraft("http"),
  name: "hub",
  url: "https://hub.example/mcp/$smart/code",
  headers: [newMcpPair("Authorization", "Bearer key")],
};

describe("MCP server drafts", () => {
  it("round-trips a remote and a stdio server", () => {
    const remote = mcpServerFromDraft(hubDraft);
    expect(remote).toMatchObject({
      transport: "http",
      name: "hub",
      headers: { Authorization: "Bearer key" },
    });
    // Each row gets a fresh id; everything else comes back as it went in.
    const back = draftFromMcpServer(remote);
    expect(back).toEqual({
      ...hubDraft,
      headers: [expect.objectContaining({ key: "Authorization", value: "Bearer key" })],
    });
    expect(back.headers[0]!.id).not.toBe(hubDraft.headers[0]!.id);
    const stdio = mcpServerFromDraft({
      ...emptyMcpServerDraft("stdio"),
      name: "local",
      command: "npx",
      args: "-y\n\n some-mcp \n",
      env: [newMcpPair(" TOKEN ", "abc"), newMcpPair("", "dropped")],
    });
    expect(stdio).toMatchObject({ args: ["-y", "some-mcp"], env: { TOKEN: "abc" } });
  });

  it("names the first problem in plain words", () => {
    expect(validateMcpServerDraft(hubDraft, [])).toBeNull();
    expect(validateMcpServerDraft({ ...hubDraft, name: "" }, [])).toMatch(/name/);
    expect(validateMcpServerDraft({ ...hubDraft, name: "t3-code-x" }, [])).toMatch(/reserved/);
    expect(validateMcpServerDraft({ ...hubDraft, name: "a b" }, [])).toMatch(/letters/);
    expect(validateMcpServerDraft(hubDraft, ["hub"])).toMatch(/Another/);
    expect(validateMcpServerDraft({ ...hubDraft, url: "hub.example" }, [])).toMatch(/URL/);
    expect(validateMcpServerDraft({ ...emptyMcpServerDraft("stdio"), name: "x" }, [])).toMatch(
      /command/,
    );
  });
});

describe("parseMcpServersJson", () => {
  it("reads the shared mcpServers shape, remote and stdio, and skips what it cannot use", () => {
    const result = parseMcpServersJson(
      JSON.stringify({
        mcpServers: {
          hub: { url: "https://hub.example/mcp", headers: { Authorization: "Bearer k" } },
          local: { command: "npx", args: ["-y", "x"], env: { A: "1" } },
          live: { type: "sse", url: "https://sse.example" },
          taken: { command: "x" },
          "bad name": { command: "x" },
        },
      }),
      ["taken"],
    );
    expect(result.servers.map((server) => server.name)).toEqual(["hub", "local"]);
    expect(result.skipped).toEqual(["live", "taken", "bad name"]);
    expect(result.error).toBeNull();
  });

  it("accepts the bare map and reports unusable input", () => {
    expect(parseMcpServersJson('{"a":{"command":"x"}}', []).servers).toHaveLength(1);
    expect(parseMcpServersJson("nope", []).error).toMatch(/JSON/);
    expect(parseMcpServersJson("[]", []).error).toMatch(/object/);
    expect(parseMcpServersJson('{"a":{"url":"ftp://x"}}', []).error).toMatch(/No server/);
  });
});
