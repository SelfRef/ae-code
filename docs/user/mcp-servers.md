# MCP servers

Add an MCP server once and every agent on the providers you choose gets its tools, beside T3 Code's own. Open
**Settings → MCP servers**. The list belongs to one environment, so pick the environment first.

Providers: Claude, Codex, OpenCode and Antigravity, and the other providers that speak ACP. Cursor and Pi keep their own
MCP setup and do not get these servers.

## Add a server

Choose **Add server**, name it (letters, digits, `_` and `-`; names starting with `t3-code` are reserved), and pick a
kind:

- **Remote (HTTP):** the server's URL and any headers it needs, such as `Authorization: Bearer …`. A gateway that serves
  several tools behind one URL, such as an MCPHub group (`https://hub.example/mcp/$smart/code`), is one remote server.
- **Command (stdio):** a command to run on the machine the environment runs on, one argument per line, and environment
  variables for it.

Header and environment values are kept in the server's secret store, not in the settings file, and the page shows them
as hidden after saving. Leave **Providers** empty to give the server to every provider, or choose some.

**Paste JSON** takes the `mcpServers` object most tools share (`{ "mcpServers": { "name": { "url": … } } }` or just the
inner object). A server with a `url` becomes remote, one with a `command` becomes a command server. Names already taken
and servers that use server-sent events are skipped, and the page says which.

Each server has an enable switch, an edit button and a remove button. A change reaches the sessions that start
afterwards; a running session keeps what it had.

## Trusted servers

By default each provider asks before it uses a tool, as it does for any MCP tool. Turn on **Trusted** to allow all of a
server's tools without asking. This matters for a gateway: behind one URL the agent calls a generic tool with the real
tool as an argument, so a rule on tool names cannot tell reads from writes, and the gateway is what decides.

Trusted works in Claude (not in a read-only sandbox) and OpenCode. Codex and the ACP providers ask as usual.

## Who can change them

Changing the list needs the permission to manage providers, because a command server runs on the machine. On a remote
environment, the connection must have it.
