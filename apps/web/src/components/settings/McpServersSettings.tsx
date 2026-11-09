import type { EnvironmentId, McpServerConfig } from "@t3tools/contracts";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { requestConfirmDialog } from "../../confirmDialog";
import { useEnvironmentSettings, useUpdateEnvironmentSettings } from "../../hooks/useSettings";
import { useEnvironmentProviders } from "../../state/environments";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import {
  draftFromMcpServer,
  emptyMcpServerDraft,
  mcpServerFromDraft,
  newMcpPair,
  parseMcpServersJson,
  validateMcpServerDraft,
  type McpPair,
  type McpServerDraft,
} from "./mcpServersSettings.logic";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useSettingsScope } from "./SettingsScopeContext";

type Editor =
  | { readonly mode: "add" }
  | { readonly mode: "edit"; readonly name: string }
  | { readonly mode: "import" };

export function McpServersSettingsPanel() {
  const { environment } = useSettingsScope();
  return (
    <SettingsPageContainer>
      {environment?.connection.phase === "connected" ? (
        <EnvironmentMcpServers
          key={environment.environmentId}
          environmentId={environment.environmentId}
        />
      ) : (
        <SettingsSection {...searchableSetting("mcp-servers")}>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Connect an environment to manage the MCP servers its agents get.
          </p>
        </SettingsSection>
      )}
    </SettingsPageContainer>
  );
}

function EnvironmentMcpServers({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const servers = useEnvironmentSettings(environmentId, (settings) => settings.mcpServers);
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const providers = useEnvironmentProviders().get(environmentId) ?? [];
  const [editor, setEditor] = useState<Editor | null>(null);
  const save = (next: ReadonlyArray<McpServerConfig>, onSaved?: () => void) =>
    updateSettings({ mcpServers: next }, onSaved ? { onSaved } : undefined);
  const providerLabel = (instanceId: string) =>
    providers.find((provider) => provider.instanceId === instanceId)?.displayName ?? instanceId;

  return (
    <SettingsSection
      {...searchableSetting("mcp-servers")}
      headerAction={
        editor === null ? (
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={() => setEditor({ mode: "import" })}>
              Paste JSON
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditor({ mode: "add" })}>
              <PlusIcon className="size-3" aria-hidden />
              Add server
            </Button>
          </div>
        ) : null
      }
    >
      {editor?.mode === "import" ? (
        <ImportPanel
          taken={servers.map((server) => server.name)}
          onCancel={() => setEditor(null)}
          onImport={(imported) => save([...servers, ...imported], () => setEditor(null))}
        />
      ) : null}
      {editor?.mode === "add" || editor?.mode === "edit" ? (
        <ServerEditor
          key={editor.mode === "edit" ? editor.name : "new"}
          initial={
            editor.mode === "edit"
              ? draftFromMcpServer(servers.find((server) => server.name === editor.name)!)
              : emptyMcpServerDraft()
          }
          otherNames={servers
            .filter((server) => editor.mode !== "edit" || server.name !== editor.name)
            .map((server) => server.name)}
          providers={providers
            .filter((provider) => provider.enabled)
            .map((provider) => ({
              id: provider.instanceId,
              label: provider.displayName ?? provider.instanceId,
            }))}
          onCancel={() => setEditor(null)}
          onSave={(draft) => {
            const next = mcpServerFromDraft(draft);
            save(
              editor.mode === "edit"
                ? servers.map((server) => (server.name === editor.name ? next : server))
                : [...servers, next],
              () => setEditor(null),
            );
          }}
        />
      ) : null}
      {servers.length === 0 && editor === null ? (
        <SettingsRow
          title="No MCP servers yet."
          description="Add one MCP server here and every agent on the providers you choose gets it, beside T3 Code's own tools."
        />
      ) : (
        servers.map((server) => (
          <SettingsRow
            key={server.name}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {server.name}
                <Badge variant="outline">
                  {server.transport === "http" ? "Remote" : "Command"}
                </Badge>
                {server.trusted ? <Badge variant="outline">Trusted</Badge> : null}
              </span>
            }
            description={
              <span className="wrap-anywhere">
                {server.transport === "http"
                  ? server.url
                  : [server.command, ...server.args].join(" ")}
                {" · "}
                {server.providerInstanceIds.length === 0
                  ? "All providers"
                  : server.providerInstanceIds.map(providerLabel).join(", ")}
              </span>
            }
            control={
              <div className="flex items-center gap-1">
                <Switch
                  aria-label={`${server.name} enabled`}
                  checked={server.enabled}
                  onCheckedChange={(checked) =>
                    save(
                      servers.map((item) =>
                        item.name === server.name ? { ...item, enabled: Boolean(checked) } : item,
                      ),
                    )
                  }
                />
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Edit ${server.name}`}
                  onClick={() => setEditor({ mode: "edit", name: server.name })}
                >
                  <PencilIcon className="size-3.5" aria-hidden />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${server.name}`}
                  onClick={async () => {
                    const confirmed = await requestConfirmDialog(
                      `Remove ${server.name}? Agents lose its tools in their next session.`,
                      { variant: "destructive" },
                    );
                    if (confirmed === false) return;
                    save(servers.filter((item) => item.name !== server.name));
                  }}
                >
                  <Trash2Icon className="size-3.5" aria-hidden />
                </Button>
              </div>
            }
          />
        ))
      )}
      <p className="px-4 py-3 text-xs text-muted-foreground">
        New and changed servers reach sessions that start afterwards. Header and environment values
        stay on the server. A trusted server's tools run without asking, where the provider allows
        it.
      </p>
    </SettingsSection>
  );
}

function PairsEditor({
  label,
  keyPlaceholder,
  valuePlaceholder,
  pairs,
  onChange,
}: {
  readonly label: string;
  readonly keyPlaceholder: string;
  readonly valuePlaceholder: string;
  readonly pairs: ReadonlyArray<McpPair>;
  readonly onChange: (pairs: ReadonlyArray<McpPair>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button size="xs" variant="ghost" onClick={() => onChange([...pairs, newMcpPair()])}>
          <PlusIcon className="size-3" aria-hidden />
          Add
        </Button>
      </div>
      {pairs.map((pair, index) => (
        <div key={pair.id} className="flex items-center gap-1.5">
          <Input
            size="sm"
            aria-label={`${label} name ${index + 1}`}
            placeholder={keyPlaceholder}
            value={pair.key}
            onChange={(event) =>
              onChange(pairs.map((p, i) => (i === index ? { ...p, key: event.target.value } : p)))
            }
          />
          <Input
            size="sm"
            type="password"
            autoComplete="off"
            aria-label={`${label} value ${index + 1}`}
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={(event) =>
              onChange(pairs.map((p, i) => (i === index ? { ...p, value: event.target.value } : p)))
            }
          />
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={() => onChange(pairs.filter((_, i) => i !== index))}
          >
            <XIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ServerEditor({
  initial,
  otherNames,
  providers,
  onCancel,
  onSave,
}: {
  readonly initial: McpServerDraft;
  readonly otherNames: ReadonlyArray<string>;
  readonly providers: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly onCancel: () => void;
  readonly onSave: (draft: McpServerDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const patch = (next: Partial<McpServerDraft>) => setDraft((current) => ({ ...current, ...next }));
  const problem = validateMcpServerDraft(draft, otherNames);
  const toggleProvider = (id: string) =>
    patch({
      providerInstanceIds: draft.providerInstanceIds.includes(id)
        ? draft.providerInstanceIds.filter((item) => item !== id)
        : [...draft.providerInstanceIds, id],
    });
  return (
    <form
      className="space-y-3 px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (problem === null) onSave(draft);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          size="sm"
          className="max-w-56"
          aria-label="Server name"
          placeholder="Name, such as hub"
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
        {(["http", "stdio"] as const).map((transport) => (
          <Button
            key={transport}
            type="button"
            size="xs"
            variant={draft.transport === transport ? "default" : "outline"}
            aria-pressed={draft.transport === transport}
            onClick={() => patch({ transport })}
          >
            {transport === "http" ? "Remote (HTTP)" : "Command (stdio)"}
          </Button>
        ))}
      </div>
      {draft.transport === "http" ? (
        <>
          <Input
            size="sm"
            aria-label="Server URL"
            placeholder="https://example.com/mcp"
            value={draft.url}
            onChange={(event) => patch({ url: event.target.value })}
          />
          <PairsEditor
            label="Headers"
            keyPlaceholder="Authorization"
            valuePlaceholder="Bearer …"
            pairs={draft.headers}
            onChange={(headers) => patch({ headers })}
          />
        </>
      ) : (
        <>
          <Input
            size="sm"
            aria-label="Command"
            placeholder="npx"
            value={draft.command}
            onChange={(event) => patch({ command: event.target.value })}
          />
          <Textarea
            aria-label="Arguments, one per line"
            placeholder={"Arguments, one per line:\n-y\n@modelcontextprotocol/server-everything"}
            value={draft.args}
            onChange={(event) => patch({ args: event.target.value })}
          />
          <PairsEditor
            label="Environment"
            keyPlaceholder="NAME"
            valuePlaceholder="value"
            pairs={draft.env}
            onChange={(env) => patch({ env })}
          />
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Providers</span>
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            size="xs"
            variant={draft.providerInstanceIds.includes(provider.id) ? "default" : "outline"}
            aria-pressed={draft.providerInstanceIds.includes(provider.id)}
            onClick={() => toggleProvider(provider.id)}
          >
            {provider.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">
          {draft.providerInstanceIds.length === 0 ? "All providers" : null}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          aria-label="Trusted"
          checked={draft.trusted}
          onCheckedChange={(checked) => patch({ trusted: Boolean(checked) })}
        />
        Trusted: allow its tools without asking
      </label>
      {problem !== null && draft.name.trim() !== "" ? (
        <p className="text-xs text-destructive">{problem}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={problem !== null}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ImportPanel({
  taken,
  onCancel,
  onImport,
}: {
  readonly taken: ReadonlyArray<string>;
  readonly onCancel: () => void;
  readonly onImport: (servers: ReadonlyArray<McpServerConfig>) => void;
}) {
  const [text, setText] = useState("");
  const result = text.trim() === "" ? null : parseMcpServersJson(text, taken);
  return (
    <div className="space-y-2 px-4 py-3">
      <Textarea
        autoFocus
        aria-label="mcpServers JSON"
        placeholder={
          '{ "mcpServers": { "hub": { "url": "https://…/mcp", "headers": { "Authorization": "Bearer …" } } } }'
        }
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {result?.error ? <p className="text-xs text-destructive">{result.error}</p> : null}
      {result !== null && result.error === null ? (
        <p className="text-xs text-muted-foreground">
          {result.servers.length} to add
          {result.skipped.length > 0
            ? `; skipped ${result.skipped.join(", ")} (taken, invalid or not supported)`
            : ""}
          .
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={result === null || result.error !== null}
          onClick={() => result && onImport(result.servers)}
        >
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
