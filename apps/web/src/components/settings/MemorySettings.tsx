import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  DEFAULT_MEMORY_SETTINGS,
  MEMORY_TEXT_MAX_CHARS,
  type EnvironmentId,
  type Memory,
  type MemoryScope,
  type MemorySetSettingsInput,
  type ProjectId,
} from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { requestConfirmDialog } from "../../confirmDialog";
import { useNowMinute } from "../../hooks/useNowMinute";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { useProjects } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  MEMORY_SCOPE_DESCRIPTIONS,
  MEMORY_SCOPE_NAMES,
  filterMemories,
  memoryMoveTarget,
  memoryOriginLabel,
  memoryProjectFilters,
  memoryScopeLabel,
  selectableProjects,
  type MemoryScopeFilter,
} from "@t3tools/client-runtime/memory-presentation";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useSettingsScope } from "./SettingsScopeContext";

// The minute tick keeps the label current, and keeps render-time Date.now() out of the compiler's cache.
function UpdatedLabel({ value }: { readonly value: string }) {
  const nowMinute = useNowMinute();
  return formatRelativeTimeLabel(value, Date.parse(`${nowMinute}:00.000Z`));
}

type Draft = { readonly mode: "add" } | { readonly mode: "edit"; readonly memory: Memory };

export function MemorySettingsPanel() {
  const { environment } = useSettingsScope();
  return (
    <SettingsPageContainer>
      {environment?.connection.phase === "connected" ? (
        <EnvironmentMemory
          key={environment.environmentId}
          environmentId={environment.environmentId}
        />
      ) : (
        <SettingsSection {...searchableSetting("memory")}>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Connect an environment to see what its agents remember.
          </p>
        </SettingsSection>
      )}
    </SettingsPageContainer>
  );
}

function EnvironmentMemory({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const list = useEnvironmentQuery(serverEnvironment.memoryList({ environmentId, input: {} }));
  const canWrite = useAtomValue(serverEnvironment.saveMemory.permissionAtom(environmentId));
  const projects = selectableProjects(useProjects(), environmentId);
  const projectTitles = new Map(projects.map((project) => [project.id, project.title]));
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<MemoryScopeFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useAtomCommand(serverEnvironment.saveMemory, { label: "memory save" });
  const remove = useAtomCommand(serverEnvironment.deleteMemory, { label: "memory delete" });
  const setSettings = useAtomCommand(serverEnvironment.setMemorySettings, {
    label: "memory settings",
  });

  const fail = (title: string, result: Parameters<typeof squashAtomCommandFailure>[0]) =>
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title,
        description: String(squashAtomCommandFailure(result)),
      }),
    );

  const memories = list.data?.memories ?? [];
  const settings = list.data?.settings ?? DEFAULT_MEMORY_SETTINGS;
  const peers = list.data?.peers ?? [];
  const shown = filterMemories(memories, query, scope);
  const projectFilters = memoryProjectFilters(memories, projectTitles);
  const scopeFilterLabel =
    scope === "all"
      ? "Everything"
      : (MEMORY_SCOPE_NAMES[scope as MemoryScope] ??
        projectFilters.find((entry) => entry.value === scope)?.label ??
        "Removed project");
  const changeSettings = async (input: MemorySetSettingsInput) => {
    const result = await setSettings({ environmentId, input });
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) fail("Could not change memory settings", result);
      return;
    }
    list.refresh();
  };

  return (
    <SettingsSection
      {...searchableSetting("memory")}
      headerAction={
        canWrite && draft === null ? (
          <Button size="xs" variant="outline" onClick={() => setDraft({ mode: "add" })}>
            <PlusIcon className="size-3" aria-hidden />
            Add memory
          </Button>
        ) : null
      }
    >
      <SettingsRow
        title="Agent memory"
        description={
          <>
            Agents on every provider can recall and save memories. Off: agents are not told about it
            and the tools refuse; saved memories stay. New sessions only. Claude's own memory:{" "}
            <Link to="/settings/providers" className="underline">
              Providers
            </Link>
            .
          </>
        }
        control={
          <Switch
            aria-label="Agent memory"
            checked={settings.enabled}
            disabled={!canWrite}
            onCheckedChange={(checked) => void changeSettings({ enabled: Boolean(checked) })}
          />
        }
      />
      <SettingsRow
        title="Sync with linked environments"
        description="Global and project memories sync with environments linked over a full-access link (Settings → Connections), both ways. This environment's memories stay here."
        status={
          peers.length === 0 ? null : (
            <span className="flex flex-col gap-0.5">
              {peers.map((peer) => (
                <span key={peer.environmentId}>
                  {peer.label}:{" "}
                  {peer.lastError !== null ? (
                    <span className="text-destructive">{peer.lastError}</span>
                  ) : peer.lastSyncedAt !== null ? (
                    <>
                      synced <UpdatedLabel value={peer.lastSyncedAt} />
                    </>
                  ) : (
                    "not synced yet"
                  )}
                </span>
              ))}
            </span>
          )
        }
        control={
          <Switch
            aria-label="Sync memory with linked environments"
            checked={settings.sync}
            disabled={!canWrite}
            onCheckedChange={(checked) => void changeSettings({ sync: Boolean(checked) })}
          />
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="grid min-w-40 flex-1 grid-cols-1">
          <Input
            type="search"
            size="sm"
            aria-label="Search memory"
            placeholder="Search memory"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={scope} onValueChange={(value) => setScope(value as MemoryScopeFilter)}>
          <div className="grid w-48 shrink-0 grid-cols-1">
            <SelectTrigger size="sm" aria-label="Memory scope">
              <SelectValue>{scopeFilterLabel}</SelectValue>
            </SelectTrigger>
          </div>
          <SelectPopup>
            <SelectItem value="all">Everything</SelectItem>
            {(["user", "environment", "project"] as const).map((value) => (
              <SelectItem key={value} value={value}>
                {MEMORY_SCOPE_NAMES[value]}
              </SelectItem>
            ))}
            {projectFilters.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>
      {draft !== null ? (
        <MemoryEditor
          key={draft.mode === "edit" ? draft.memory.id : "new"}
          draft={draft}
          projects={projects}
          onCancel={() => setDraft(null)}
          onSave={async (input) => {
            const result = await save({ environmentId, input });
            if (result._tag === "Failure") {
              if (!isAtomCommandInterrupted(result)) fail("Could not save memory", result);
              return;
            }
            setDraft(null);
            list.refresh();
          }}
        />
      ) : null}
      {list.error !== null && list.data === null ? (
        <p className="px-4 pb-3 text-sm text-destructive">{list.error}</p>
      ) : shown.length === 0 ? (
        <SettingsRow
          title={memories.length === 0 ? "Nothing remembered yet." : "No memory matches."}
          description={
            memories.length === 0
              ? "Agents save lasting preferences and decisions as you work. You can add one yourself."
              : "Try another search or scope."
          }
        />
      ) : (
        shown.map((memory) => (
          <SettingsRow
            key={memory.id}
            title={<span className="whitespace-pre-wrap wrap-anywhere">{memory.text}</span>}
            status={
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{memoryScopeLabel(memory, projectTitles)}</Badge>
                {memoryOriginLabel(memory, peers) === null ? null : (
                  <span>{memoryOriginLabel(memory, peers)}</span>
                )}
                <span>
                  {memory.source === "agent" ? "Saved by an agent" : "Added by you"} ·{" "}
                  <UpdatedLabel value={memory.updatedAt} />
                </span>
              </span>
            }
            control={
              canWrite ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Edit or move memory"
                    onClick={() => setDraft({ mode: "edit", memory })}
                  >
                    <PencilIcon className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Forget memory"
                    onClick={async () => {
                      const confirmed = await requestConfirmDialog(
                        "Forget this memory? Agents will no longer recall it.",
                        { variant: "destructive" },
                      );
                      if (confirmed === false) return;
                      const result = await remove({ environmentId, input: { id: memory.id } });
                      if (result._tag === "Failure") {
                        if (!isAtomCommandInterrupted(result))
                          fail("Could not forget memory", result);
                        return;
                      }
                      list.refresh();
                    }}
                  >
                    <Trash2Icon className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ) : null
            }
          />
        ))
      )}
    </SettingsSection>
  );
}

function MemoryEditor({
  draft,
  projects,
  onCancel,
  onSave,
}: {
  readonly draft: Draft;
  readonly projects: ReadonlyArray<{ readonly id: ProjectId; readonly title: string }>;
  readonly onCancel: () => void;
  readonly onSave: (input: {
    readonly id?: Memory["id"];
    readonly scope: MemoryScope;
    readonly projectId?: ProjectId;
    readonly text: string;
  }) => Promise<void>;
}) {
  const editing = draft.mode === "edit" ? draft.memory : null;
  const [text, setText] = useState(editing?.text ?? "");
  const [scope, setScope] = useState<MemoryScope>(editing?.scope ?? "user");
  // Another environment's project memory has no project here; it stays put unless one is picked.
  const [projectId, setProjectId] = useState<ProjectId | null>(
    editing === null ? (projects[0]?.id ?? null) : editing.projectId,
  );
  const [busy, setBusy] = useState(false);
  const trimmed = text.trim();
  const valid =
    trimmed.length > 0 &&
    Array.from(trimmed).length <= MEMORY_TEXT_MAX_CHARS &&
    (scope !== "project" || projectId !== null || editing?.scope === "project");
  return (
    <div className="space-y-2 px-4 pt-3">
      <Textarea
        autoFocus
        aria-label="Memory text"
        placeholder="A lasting preference, decision or fact, such as: Use pnpm, not npm."
        value={text}
        maxLength={MEMORY_TEXT_MAX_CHARS}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={scope}
          onValueChange={(value) => {
            setScope(value as MemoryScope);
            if (value === "project" && projectId === null && editing?.scope !== "project")
              setProjectId(projects[0]?.id ?? null);
          }}
        >
          <div className="grid w-44 shrink-0 grid-cols-1">
            <SelectTrigger size="sm" aria-label="Scope">
              <SelectValue>{MEMORY_SCOPE_NAMES[scope]}</SelectValue>
            </SelectTrigger>
          </div>
          <SelectPopup>
            {(["user", "environment", "project"] as const).map((value) => (
              <SelectItem
                key={value}
                value={value}
                disabled={
                  value === "project" && projects.length === 0 && editing?.scope !== "project"
                }
              >
                <span className="flex flex-col">
                  <span>{MEMORY_SCOPE_NAMES[value]}</span>
                  <span className="text-xs text-muted-foreground">
                    {MEMORY_SCOPE_DESCRIPTIONS[value]}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        {scope === "project" ? (
          <Select value={projectId} onValueChange={(value) => setProjectId(value as ProjectId)}>
            <div className="grid w-48 shrink-0 grid-cols-1">
              <SelectTrigger size="sm" aria-label="Project">
                <SelectValue>
                  {projects.find((project) => project.id === projectId)?.title ??
                    editing?.projectLabel ??
                    "Choose a project"}
                </SelectValue>
              </SelectTrigger>
            </div>
            <SelectPopup>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          <Button size="xs" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="xs"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              await onSave({
                ...(editing === null ? {} : { id: editing.id }),
                ...memoryMoveTarget(editing, scope, projectId),
                text: trimmed,
              });
              setBusy(false);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
