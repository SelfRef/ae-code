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
import { filterMemories, memoryScopeLabel, type MemoryScopeFilter } from "./memorySettings.logic";
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
  const projects = useProjects().filter(
    (project) => project.environmentId === environmentId && project.isScratch !== true,
  );
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
  const shown = filterMemories(memories, query, scope);
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
        description="Agents on every provider can recall these memories and save new ones. Off: agents are not told about memory and its tools refuse; saved memories are kept. Applies to new sessions."
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
        title="Turn off Claude's built-in memory"
        description="While agent memory is on, new Claude sessions run without Claude Code's own memory, so there is one store. Other providers are not affected."
        control={
          <Switch
            aria-label="Turn off Claude's built-in memory"
            checked={settings.disableNativeMemory && settings.enabled}
            disabled={!canWrite || !settings.enabled}
            onCheckedChange={(checked) =>
              void changeSettings({ disableNativeMemory: Boolean(checked) })
            }
          />
        }
      />
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
              <SelectValue>
                {scope === "all"
                  ? "Everything"
                  : scope === "user"
                    ? "All projects"
                    : (projectTitles.get(scope as ProjectId) ?? "Removed project")}
              </SelectValue>
            </SelectTrigger>
          </div>
          <SelectPopup>
            <SelectItem value="all">Everything</SelectItem>
            <SelectItem value="user">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>
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
                    aria-label="Edit memory"
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
  const [projectId, setProjectId] = useState<ProjectId | null>(
    editing?.projectId ?? projects[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const trimmed = text.trim();
  const valid =
    trimmed.length > 0 &&
    Array.from(trimmed).length <= MEMORY_TEXT_MAX_CHARS &&
    (scope === "user" || projectId !== null);
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
        {editing === null ? (
          <>
            <Select value={scope} onValueChange={(value) => setScope(value as MemoryScope)}>
              <div className="grid w-40 shrink-0 grid-cols-1">
                <SelectTrigger size="sm" aria-label="Scope">
                  <SelectValue>{scope === "user" ? "All projects" : "One project"}</SelectValue>
                </SelectTrigger>
              </div>
              <SelectPopup>
                <SelectItem value="user">All projects</SelectItem>
                <SelectItem value="project" disabled={projects.length === 0}>
                  One project
                </SelectItem>
              </SelectPopup>
            </Select>
            {scope === "project" ? (
              <Select value={projectId} onValueChange={(value) => setProjectId(value as ProjectId)}>
                <div className="grid w-48 shrink-0 grid-cols-1">
                  <SelectTrigger size="sm" aria-label="Project">
                    <SelectValue>
                      {projects.find((project) => project.id === projectId)?.title}
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
          </>
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
                scope,
                ...(scope === "project" && projectId !== null ? { projectId } : {}),
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
