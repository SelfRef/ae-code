import { useAtomValue } from "@effect/atom-react";
import {
  filterMemories,
  MEMORY_SCOPE_DESCRIPTIONS,
  MEMORY_SCOPE_NAMES,
  memoryMoveTarget,
  memoryOriginLabel,
  memoryProjectFilters,
  memoryScopeLabel,
  selectableProjects,
  type MemoryScopeFilter,
} from "@t3tools/client-runtime/memory-presentation";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
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
import { useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, type TextInputInstance, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelativeTime } from "../../components/RelativeTime";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import * as Dialog from "../../components/ui/Dialog";
import { ListActionRow } from "../../components/ui/ListActionRow";
import { ListChoiceRow } from "../../components/ui/ListChoiceRow";
import { Menu } from "../../components/ui/Menu";
import { ScreenScrollView } from "../../components/ui/ScreenScrollView";
import { SearchField } from "../../components/ui/SearchField";
import { Sheet } from "../../components/ui/Sheet";
import { useProjects } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { useSettingsEnvironmentMenu } from "./components/SettingsEnvironmentFilterHeader";
import { SettingsScreen } from "./components/SettingsScreen";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsSwitchRow } from "./components/SettingsSwitchRow";
import { useSettingsEnvironmentFilter, type SettingsTarget } from "./settings-environment-filter";
import { settingsTargetsForProject } from "./settings-environment-filter.logic";

const SCOPES: ReadonlyArray<MemoryScope> = ["user", "environment", "project"];

type Draft = { readonly mode: "add" } | { readonly mode: "edit"; readonly memory: Memory };

function alertFailure(title: string, result: AtomCommandResult<unknown, unknown>): boolean {
  if (result._tag !== "Failure") return false;
  if (!isAtomCommandInterrupted(result)) {
    Dialog.alert(title, String(squashAtomCommandFailure(result)));
  }
  return true;
}

export function SettingsMemoryRouteScreen() {
  const { availableTargets, selectedTargets, selectedProjectKey, projectGroups } =
    useSettingsEnvironmentFilter();
  const environments = settingsTargetsForProject(
    selectedTargets,
    selectedProjectKey === null
      ? null
      : projectGroups.find((group) => group.key === selectedProjectKey),
  );
  const environmentMenu = useSettingsEnvironmentMenu();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInputInstance | null>(null);
  const [query, setQuery] = useState("");

  return (
    <SettingsScreen title="Memory" menus={[environmentMenu]}>
      <ScreenScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        {environments.length > 0 ? (
          <>
            <View className="flex-row">
              <SearchField
                inputRef={searchRef}
                autoFocus={false}
                accessibilityLabel="Search memory"
                clearAccessibilityLabel="Clear memory search"
                placeholder="Search memory"
                value={query}
                onChangeText={setQuery}
              />
            </View>
            {environments.map((environment) => (
              <EnvironmentMemory
                key={environment.environmentId}
                environment={environment}
                query={query}
                showLabel={availableTargets.length > 1}
              />
            ))}
          </>
        ) : (
          <Text className="px-2 text-base text-foreground-muted">
            {availableTargets.length === 0
              ? "Connect an environment to see what its agents remember."
              : "No environments match these filters. Change the filter above."}
          </Text>
        )}
      </ScreenScrollView>
    </SettingsScreen>
  );
}

function EnvironmentMemory({
  environment,
  query,
  showLabel,
}: {
  readonly environment: SettingsTarget;
  readonly query: string;
  readonly showLabel: boolean;
}) {
  const environmentId = environment.environmentId;
  const list = useEnvironmentQuery(serverEnvironment.memoryList({ environmentId, input: {} }));
  const canWrite = useAtomValue(serverEnvironment.saveMemory.permissionAtom(environmentId));
  const projects = selectableProjects(useProjects(), environmentId);
  const projectTitles = new Map(projects.map((project) => [project.id, project.title]));
  const [filter, setFilter] = useState<MemoryScopeFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const setSettings = useAtomCommand(serverEnvironment.setMemorySettings, {
    label: "memory settings",
    reportFailure: false,
  });

  const memories = list.data?.memories ?? [];
  const settings = list.data?.settings ?? DEFAULT_MEMORY_SETTINGS;
  const peers = list.data?.peers ?? [];
  const shown = filterMemories(memories, query, filter);
  const filters = [
    { value: "all", label: "Everything" },
    ...SCOPES.map((scope) => ({ value: scope, label: MEMORY_SCOPE_NAMES[scope] })),
    ...memoryProjectFilters(memories, projectTitles),
  ];
  const filterLabel = filters.find((entry) => entry.value === filter)?.label ?? "Everything";
  const changeSettings = async (input: MemorySetSettingsInput) => {
    const result = await setSettings({ environmentId, input });
    if (!alertFailure("Could not change memory settings", result)) list.refresh();
  };
  const prefix = showLabel ? `${environment.label} · ` : "";

  return (
    <>
      <SettingsSection title={showLabel ? environment.label : undefined}>
        <SettingsSwitchRow
          label="Agent memory"
          subtitle="Agents on every provider can recall and save memories. Off: agents are not told about it and the tools refuse; saved memories stay. New sessions only."
          value={settings.enabled}
          disabled={!canWrite || list.data === null}
          onValueChange={(enabled) => void changeSettings({ enabled })}
        />
        <View className="border-t border-border-subtle">
          <SettingsSwitchRow
            label="Sync with linked environments"
            subtitle="Global and project memories sync over full-access links."
            value={settings.sync}
            disabled={!canWrite || list.data === null}
            onValueChange={(sync) => void changeSettings({ sync })}
          />
        </View>
        {peers.map((peer) => (
          <View
            key={peer.environmentId}
            className="gap-0.5 border-t border-border-subtle px-4 py-3"
          >
            <Text textRole="body" className="text-foreground" numberOfLines={1}>
              {peer.label}
            </Text>
            {peer.lastError !== null ? (
              <Text className="text-sm text-danger-foreground" numberOfLines={2}>
                {peer.lastError}
              </Text>
            ) : (
              <Text className="text-sm text-foreground-muted">
                {peer.lastSyncedAt === null ? (
                  "Not synced yet"
                ) : (
                  <>
                    Synced <RelativeTime timestamp={peer.lastSyncedAt} /> ago
                  </>
                )}
              </Text>
            )}
          </View>
        ))}
      </SettingsSection>
      <SettingsSection
        title={`${prefix}Memories`}
        trailing={
          <View className="flex-row items-center gap-1">
            <Menu
              title="Show"
              actions={filters.map((entry) => ({
                id: entry.value,
                title: entry.label,
                state: entry.value === filter ? "on" : "off",
              }))}
              onPressAction={({ nativeEvent }) => setFilter(nativeEvent.event)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Memory scope, ${filterLabel}`}
                className="min-h-11 flex-row items-center gap-1.5 px-2 active:opacity-60"
              >
                <Text className="text-sm font-t3-medium text-foreground-muted" numberOfLines={1}>
                  {filterLabel}
                </Text>
                <SymbolView name="chevron.down" size={11} tintColorClassName="accent-icon-muted" />
              </Pressable>
            </Menu>
            {canWrite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add memory"
                className="h-11 w-11 items-center justify-center active:opacity-60"
                onPress={() => setDraft({ mode: "add" })}
              >
                <SymbolView name="plus" size={18} tintColorClassName="accent-icon" />
              </Pressable>
            ) : null}
          </View>
        }
      >
        {list.error !== null && list.data === null ? (
          <Text className="p-4 text-base text-danger-foreground">{list.error}</Text>
        ) : list.data === null ? (
          <Text className="p-4 text-base text-foreground-muted">Loading memory…</Text>
        ) : shown.length === 0 ? (
          <Text className="p-4 text-base text-foreground-muted">
            {memories.length === 0
              ? "Nothing remembered yet. Agents save lasting preferences and decisions as you work."
              : "No memory matches. Try another search or scope."}
          </Text>
        ) : (
          shown.map((memory, index) => {
            const origin = memoryOriginLabel(memory, peers);
            return (
              <Pressable
                key={memory.id}
                accessibilityRole="button"
                accessibilityLabel={memory.text}
                accessibilityHint={canWrite ? "Edit memory" : undefined}
                disabled={!canWrite}
                onPress={() => setDraft({ mode: "edit", memory })}
                className={
                  index === 0
                    ? "gap-1.5 px-4 py-3 active:opacity-70"
                    : "gap-1.5 border-t border-border-subtle px-4 py-3 active:opacity-70"
                }
              >
                <Text textRole="body" className="text-foreground" numberOfLines={3}>
                  {memory.text}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text
                    className="shrink rounded-full bg-subtle px-2 py-0.5 text-xs text-foreground"
                    numberOfLines={1}
                  >
                    {memoryScopeLabel(memory, projectTitles)}
                  </Text>
                  <Text className="shrink-0 text-sm text-foreground-muted" numberOfLines={1}>
                    {origin !== null ? `${origin} · ` : ""}
                    {memory.source === "agent" ? "Agent" : "You"} ·{" "}
                    <RelativeTime timestamp={memory.updatedAt} />
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </SettingsSection>
      {draft !== null ? (
        <MemoryEditorSheet
          key={draft.mode === "edit" ? draft.memory.id : "new"}
          environmentId={environmentId}
          draft={draft}
          projects={projects}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            list.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function MemoryEditorSheet({
  environmentId,
  draft,
  projects,
  onClose,
  onSaved,
}: {
  readonly environmentId: EnvironmentId;
  readonly draft: Draft;
  readonly projects: ReadonlyArray<{ readonly id: ProjectId; readonly title: string }>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const editing = draft.mode === "edit" ? draft.memory : null;
  const [text, setText] = useState(editing?.text ?? "");
  const [scope, setScope] = useState<MemoryScope>(editing?.scope ?? "user");
  // An edited project memory whose project is not on this environment starts with none picked,
  // so saving keeps it in place.
  const [projectId, setProjectId] = useState<ProjectId | null>(
    editing?.scope === "project" ? editing.projectId : (projects[0]?.id ?? null),
  );
  const [busy, setBusy] = useState(false);
  const save = useAtomCommand(serverEnvironment.saveMemory, {
    label: "memory save",
    reportFailure: false,
  });
  const remove = useAtomCommand(serverEnvironment.deleteMemory, {
    label: "memory delete",
    reportFailure: false,
  });
  const trimmed = text.trim();
  const keepsUnknownProject =
    editing !== null && editing.scope === "project" && scope === "project" && projectId === null;
  const valid =
    trimmed.length > 0 &&
    Array.from(trimmed).length <= MEMORY_TEXT_MAX_CHARS &&
    (scope !== "project" || projectId !== null || keepsUnknownProject);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const result = await save({
      environmentId,
      input: {
        ...(editing === null ? {} : { id: editing.id }),
        ...memoryMoveTarget(editing, scope, projectId),
        text: trimmed,
      },
    });
    setBusy(false);
    if (!alertFailure("Could not save memory", result)) onSaved();
  };
  const forget = () => {
    if (editing === null) return;
    Dialog.confirm({
      title: "Forget this memory?",
      message: "Agents will no longer recall it.",
      confirmText: "Forget",
      destructive: true,
      onConfirm: () =>
        void (async () => {
          setBusy(true);
          const result = await remove({ environmentId, input: { id: editing.id } });
          setBusy(false);
          if (!alertFailure("Could not forget memory", result)) onSaved();
        })(),
    });
  };

  return (
    <Sheet
      title={editing === null ? "Add memory" : "Edit memory"}
      onClose={onClose}
      dismissDisabled={busy}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5 pt-2 pb-8"
      >
        <SettingsSection>
          <View className="px-4 py-3">
            <TextInput
              accessibilityLabel="Memory text"
              placeholder="A lasting preference, decision or fact, such as: Use pnpm, not npm."
              placeholderTextColorClassName="accent-placeholder"
              multiline
              autoFocus={editing === null}
              maxLength={MEMORY_TEXT_MAX_CHARS}
              editable={!busy}
              value={text}
              onChangeText={setText}
              className="min-h-24 font-sans text-base text-foreground"
              textAlignVertical="top"
            />
          </View>
        </SettingsSection>
        <SettingsSection title="Applies to">
          {SCOPES.map((option, index) => (
            <ListChoiceRow
              key={option}
              label={MEMORY_SCOPE_NAMES[option]}
              description={MEMORY_SCOPE_DESCRIPTIONS[option]}
              selected={scope === option}
              separated={index > 0}
              disabled={
                busy ||
                (option === "project" && projects.length === 0 && editing?.scope !== "project")
              }
              onPress={() => setScope(option)}
            />
          ))}
        </SettingsSection>
        {scope === "project" ? (
          <SettingsSection
            title="Project"
            footer={
              keepsUnknownProject
                ? `Stays in ${editing?.projectLabel ?? "its project"}, which is not on this environment, unless you pick a project.`
                : undefined
            }
          >
            {projects.map((project, index) => (
              <ListChoiceRow
                key={project.id}
                label={project.title}
                selected={projectId === project.id}
                separated={index > 0}
                disabled={busy}
                onPress={() => setProjectId(project.id)}
              />
            ))}
          </SettingsSection>
        ) : null}
        <SettingsSection>
          <ListActionRow
            label="Save"
            loading={busy}
            disabled={!valid}
            onPress={() => void submit()}
          />
          {editing !== null ? (
            <View className="border-t border-border-subtle">
              <ListActionRow tone="danger" label="Forget memory" disabled={busy} onPress={forget} />
            </View>
          ) : null}
        </SettingsSection>
      </ScrollView>
    </Sheet>
  );
}
