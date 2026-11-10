import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  ServerProvider,
  SkillLibraryListResult,
  SkillLibrarySkill,
  SkillLibrarySourceSkill,
} from "@t3tools/contracts";
import {
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { useState } from "react";

import { requestConfirmDialog } from "../../confirmDialog";
import { useEnvironmentProviders } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useSettingsScope } from "./SettingsScopeContext";
import {
  filterSkills,
  isValidSkillName,
  providerOwnSkills,
  skillSourceLabel,
  skillTemplate,
  targetLabel,
} from "./skillsSettings.logic";

type Panel =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly id: string }
  | { readonly mode: "install" };

export function SkillsSettingsPanel() {
  const { environment } = useSettingsScope();
  return (
    <SettingsPageContainer>
      {environment?.connection.phase === "connected" ? (
        <EnvironmentSkills
          key={environment.environmentId}
          environmentId={environment.environmentId}
        />
      ) : (
        <SettingsSection {...searchableSetting("skills")}>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Connect an environment to manage the skills its agents get.
          </p>
        </SettingsSection>
      )}
    </SettingsPageContainer>
  );
}

function EnvironmentSkills({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const list = useEnvironmentQuery(serverEnvironment.skillsList({ environmentId, input: {} }));
  const providers = useEnvironmentProviders().get(environmentId) ?? [];
  const canWrite = useAtomValue(serverEnvironment.writeSkill.permissionAtom(environmentId));
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const write = useAtomCommand(serverEnvironment.writeSkill, { label: "skill write" });
  const remove = useAtomCommand(serverEnvironment.removeSkill, { label: "skill remove" });
  const restore = useAtomCommand(serverEnvironment.restoreSkill, { label: "skill restore" });
  const setLink = useAtomCommand(serverEnvironment.setSkillLink, { label: "skill link" });
  const update = useAtomCommand(serverEnvironment.updateSkill, { label: "skill update" });

  const fail = (title: string, result: Parameters<typeof squashAtomCommandFailure>[0]) =>
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title,
        description: String(squashAtomCommandFailure(result)),
      }),
    );
  // Runs one command; a failure is toasted, and the list is read again either way.
  const attempt = async <A,>(
    title: string,
    command: Promise<AtomCommandResult<A, unknown>>,
  ): Promise<A | undefined> => {
    const result = await command;
    list.refresh();
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) fail(title, result);
      return undefined;
    }
    return result.value;
  };

  const library: SkillLibraryListResult | null = list.data;
  const skills = library?.skills ?? [];
  const shown = filterSkills(skills, query);
  const ownSkills = library === null ? [] : providerOwnSkills(providers, library);

  return (
    <>
      <SettingsSection
        {...searchableSetting("skills")}
        headerAction={
          canWrite && panel === null ? (
            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" onClick={() => setPanel({ mode: "install" })}>
                <DownloadIcon className="size-3" aria-hidden />
                Install
              </Button>
              <Button size="xs" variant="outline" onClick={() => setPanel({ mode: "create" })}>
                <PlusIcon className="size-3" aria-hidden />
                New skill
              </Button>
            </div>
          ) : null
        }
      >
        <SettingsRow
          title="Library"
          description={
            <>
              Providers that read <code>~/.agents/skills</code> have these already; for the others,
              switch a link below. Changes reach sessions that start afterwards.
              {library === null ? null : (
                <span className="block wrap-anywhere text-muted-foreground/80">
                  {library.libraryPath}
                </span>
              )}
            </>
          }
        />
        {panel?.mode === "create" ? (
          <CreateSkillForm
            taken={skills.map((skill) => skill.id)}
            onCancel={() => setPanel(null)}
            onCreate={async (id, description) => {
              const created = await attempt(
                "Could not create the skill",
                write({
                  environmentId,
                  input: { id, mode: "create", content: skillTemplate(id, description) },
                }),
              );
              if (created !== undefined) setPanel({ mode: "edit", id });
            }}
          />
        ) : null}
        {panel?.mode === "install" ? (
          <InstallPanel
            environmentId={environmentId}
            onClose={() => setPanel(null)}
            onInstalled={() => list.refresh()}
          />
        ) : null}
        {list.error !== null && library === null ? (
          <p className="px-4 pb-3 text-sm text-destructive">{list.error}</p>
        ) : skills.length === 0 && panel === null ? (
          <SettingsRow
            title="No skills in the library yet."
            description="Create one, or install skills from a git repository such as owner/repo."
          />
        ) : (
          <>
            {skills.length > 4 ? (
              <div className="px-4 py-3">
                <Input
                  type="search"
                  size="sm"
                  aria-label="Search skills"
                  placeholder="Search skills"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            ) : null}
            {shown.map((skill) =>
              panel?.mode === "edit" && panel.id === skill.id ? (
                <SkillEditor
                  key={skill.id}
                  environmentId={environmentId}
                  skill={skill}
                  onClose={() => setPanel(null)}
                  onSaved={() => list.refresh()}
                />
              ) : (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  library={library}
                  providers={providers}
                  canWrite={canWrite}
                  onEdit={() => setPanel({ mode: "edit", id: skill.id })}
                  onToggleLink={async (instanceId, linked) => {
                    await attempt(
                      "Could not change the link",
                      setLink({ environmentId, input: { id: skill.id, instanceId, linked } }),
                    );
                  }}
                  onUpdate={async () => {
                    const updated = await attempt(
                      "Could not update the skill",
                      update({ environmentId, input: { id: skill.id } }),
                    );
                    if (updated !== undefined) {
                      toastManager.add({
                        type: "success",
                        title:
                          updated.status === "current" ? "Already up to date" : "Skill updated",
                      });
                    }
                  }}
                  onRemove={async () => {
                    const confirmed = await requestConfirmDialog(
                      `Remove ${skill.id}? It goes to the trash for 14 days, and providers lose it in their next session.`,
                      { variant: "destructive" },
                    );
                    if (confirmed === false) return;
                    await attempt(
                      "Could not remove the skill",
                      remove({ environmentId, input: { id: skill.id } }),
                    );
                  }}
                />
              ),
            )}
            {shown.length === 0 && skills.length > 0 ? (
              <SettingsRow title="No skill matches." description="Try another search." />
            ) : null}
          </>
        )}
      </SettingsSection>
      {library !== null && library.trash.length > 0 ? (
        <SettingsSection title="Recently removed">
          {library.trash.map((entry) => (
            <SettingsRow
              key={entry.id}
              title={entry.skillId}
              description={`Removed ${new Date(entry.deletedAt).toLocaleString()}; kept for 14 days.`}
              control={
                canWrite ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      void attempt(
                        "Could not restore the skill",
                        restore({ environmentId, input: { trashId: entry.id } }),
                      )
                    }
                  >
                    <Undo2Icon className="size-3" aria-hidden />
                    Restore
                  </Button>
                ) : null
              }
            />
          ))}
        </SettingsSection>
      ) : null}
      {ownSkills.length > 0 ? (
        <SettingsSection title="Skills in provider folders">
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            What providers load on their own: plugins, built-in and synced skills, and folders made
            by hand. They are managed by the provider, so they are only listed here.
          </p>
          {ownSkills.map((provider) => (
            <SettingsRow
              key={provider.instanceId}
              title={provider.displayName}
              description={
                <span className="flex flex-wrap gap-1.5 pt-1">
                  {provider.skills.map((skill) => (
                    <Badge key={skill.name} variant="outline" title={skill.path}>
                      {skill.name}
                    </Badge>
                  ))}
                </span>
              }
            />
          ))}
        </SettingsSection>
      ) : null}
    </>
  );
}

function SkillRow({
  skill,
  library,
  providers,
  canWrite,
  onEdit,
  onToggleLink,
  onUpdate,
  onRemove,
}: {
  readonly skill: SkillLibrarySkill;
  readonly library: SkillLibraryListResult | null;
  readonly providers: ReadonlyArray<Pick<ServerProvider, "instanceId" | "displayName">>;
  readonly canWrite: boolean;
  readonly onEdit: () => void;
  readonly onToggleLink: (
    instanceId: SkillLibrarySkill["providers"][number]["instanceId"],
    linked: boolean,
  ) => Promise<void>;
  readonly onUpdate: () => Promise<void>;
  readonly onRemove: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };
  return (
    <SettingsRow
      title={
        <span className="flex flex-wrap items-center gap-2">
          {skill.name}
          {skill.name !== skill.id ? <Badge variant="outline">{skill.id}</Badge> : null}
          {skill.problem === undefined ? null : <Badge variant="warning">{skill.problem}</Badge>}
        </span>
      }
      description={
        <span className="block space-y-1.5">
          {skill.description === undefined ? null : (
            <span className="block wrap-anywhere">{skill.description}</span>
          )}
          {skill.source === undefined ? null : (
            <span className="block wrap-anywhere text-muted-foreground/80">
              From {skillSourceLabel(skill.source)}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
            {(library?.targets ?? []).map((target) => {
              const state = skill.providers.find(
                (provider) => provider.instanceId === target.instanceId,
              )?.state;
              const label = targetLabel(target, providers);
              if (state === undefined || state === "unsupported") return null;
              if (state === "native") {
                return (
                  <Badge
                    key={target.instanceId}
                    variant="success"
                    title={`${label} reads the library itself.`}
                  >
                    {label}
                  </Badge>
                );
              }
              if (state === "blocked") {
                return (
                  <Badge
                    key={target.instanceId}
                    variant="warning"
                    title={`${label} already has a different skill with this name in its folder.`}
                  >
                    {label}: name taken
                  </Badge>
                );
              }
              return (
                <label key={target.instanceId} className="flex items-center gap-1.5 text-xs">
                  <Switch
                    size="sm"
                    aria-label={`${skill.id} for ${label}`}
                    checked={state === "linked"}
                    disabled={!canWrite || busy}
                    onCheckedChange={(checked) =>
                      void run(() => onToggleLink(target.instanceId, Boolean(checked)))
                    }
                  />
                  {label}
                </label>
              );
            })}
          </span>
        </span>
      }
      control={
        canWrite ? (
          <div className="flex items-center gap-1">
            {skill.source === undefined ? null : (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Update ${skill.id}`}
                disabled={busy}
                onClick={() => void run(onUpdate)}
              >
                <RefreshCwIcon className="size-3.5" aria-hidden />
              </Button>
            )}
            <Button size="icon-xs" variant="ghost" aria-label={`Edit ${skill.id}`} onClick={onEdit}>
              <PencilIcon className="size-3.5" aria-hidden />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Remove ${skill.id}`}
              disabled={busy}
              onClick={() => void run(onRemove)}
            >
              <Trash2Icon className="size-3.5" aria-hidden />
            </Button>
          </div>
        ) : null
      }
    />
  );
}

function CreateSkillForm({
  taken,
  onCancel,
  onCreate,
}: {
  readonly taken: ReadonlyArray<string>;
  readonly onCancel: () => void;
  readonly onCreate: (id: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmedName = name.trim();
  const nameProblem =
    trimmedName.length === 0
      ? null
      : !isValidSkillName(trimmedName)
        ? "Lowercase letters, digits and single hyphens, up to 64 characters."
        : taken.includes(trimmedName)
          ? "A skill with this name exists."
          : null;
  const valid = trimmedName.length > 0 && nameProblem === null && description.trim().length > 0;
  return (
    <div className="space-y-2 px-4 pt-3">
      <Input
        autoFocus
        aria-label="Skill name"
        placeholder="Name, such as review-pr"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {nameProblem === null ? null : <p className="text-xs text-destructive">{nameProblem}</p>}
      <Input
        aria-label="Skill description"
        placeholder="When should an agent use it? One sentence."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="xs"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            await onCreate(trimmedName, description);
            setBusy(false);
          }}
        >
          Create
        </Button>
      </div>
    </div>
  );
}

function SkillEditor({
  environmentId,
  skill,
  onClose,
  onSaved,
}: {
  readonly environmentId: EnvironmentId;
  readonly skill: SkillLibrarySkill;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const loaded = useEnvironmentQuery(
    serverEnvironment.skillsRead({ environmentId, input: { id: skill.id } }),
  );
  const write = useAtomCommand(serverEnvironment.writeSkill, { label: "skill save" });
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const content = draft ?? loaded.data?.content ?? "";
  const changed = draft !== null && draft !== loaded.data?.content;
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{skill.id}</span>
        <span className="text-xs text-muted-foreground wrap-anywhere">{skill.path}</span>
      </div>
      {loaded.error !== null && loaded.data === null ? (
        <p className="text-sm text-destructive">{loaded.error}</p>
      ) : (
        <Textarea
          aria-label={`SKILL.md of ${skill.id}`}
          rows={16}
          value={content}
          disabled={loaded.data === null}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {loaded.data !== null && loaded.data.files.length > 0 ? (
        <p className="text-xs text-muted-foreground wrap-anywhere">
          Also in this folder: {loaded.data.files.join(", ")}
          {loaded.data.filesTruncated ? ", …" : ""}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onClose} disabled={busy}>
          {changed ? "Discard" : "Close"}
        </Button>
        <Button
          size="xs"
          disabled={!changed || busy || content.trim().length === 0}
          onClick={async () => {
            setBusy(true);
            const result = await write({
              environmentId,
              input: { id: skill.id, mode: "replace", content },
            });
            setBusy(false);
            if (result._tag === "Failure") {
              if (!isAtomCommandInterrupted(result)) {
                toastManager.add(
                  stackedThreadToast({
                    type: "error",
                    title: "Could not save the skill",
                    description: String(squashAtomCommandFailure(result)),
                  }),
                );
              }
              return;
            }
            onSaved();
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function InstallPanel({
  environmentId,
  onClose,
  onInstalled,
}: {
  readonly environmentId: EnvironmentId;
  readonly onClose: () => void;
  readonly onInstalled: () => void;
}) {
  const inspect = useAtomCommand(serverEnvironment.inspectSkillSource, { label: "skill inspect" });
  const install = useAtomCommand(serverEnvironment.installSkills, { label: "skill install" });
  const [source, setSource] = useState("");
  const [ref, setRef] = useState("");
  const [found, setFound] = useState<ReadonlyArray<SkillLibrarySourceSkill> | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const trimmedSource = source.trim();
  const trimmedRef = ref.trim();
  const sourceInput = {
    source: trimmedSource,
    ...(trimmedRef.length === 0 ? {} : { ref: trimmedRef }),
  };

  const find = async () => {
    setBusy(true);
    setProblem(null);
    const result = await inspect({ environmentId, input: sourceInput });
    setBusy(false);
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) setProblem(String(squashAtomCommandFailure(result)));
      return;
    }
    setFound(result.value.skills);
    setSelected(
      new Set(result.value.skills.filter((skill) => !skill.installed).map((skill) => skill.path)),
    );
  };

  const installSelected = async () => {
    setBusy(true);
    setProblem(null);
    const result = await install({
      environmentId,
      input: { ...sourceInput, paths: [...selected], replace },
    });
    setBusy(false);
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) setProblem(String(squashAtomCommandFailure(result)));
      return;
    }
    onInstalled();
    const { installed, skipped } = result.value;
    if (skipped.length > 0) {
      setProblem(
        skipped.map((entry) => `${entry.path || "repository"}: ${entry.reason}`).join("\n"),
      );
      if (installed.length === 0) return;
    }
    toastManager.add({
      type: "success",
      title: `Installed ${installed.length} ${installed.length === 1 ? "skill" : "skills"}`,
    });
    if (skipped.length === 0) onClose();
  };

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid min-w-48 flex-1 grid-cols-1">
          <Input
            autoFocus
            aria-label="Skill source"
            placeholder="owner/repo, owner/repo@skill, or a git URL"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setFound(null);
            }}
          />
        </div>
        <div className="grid w-40 shrink-0 grid-cols-1">
          <Input
            aria-label="Branch or tag"
            placeholder="Branch or tag"
            value={ref}
            onChange={(event) => {
              setRef(event.target.value);
              setFound(null);
            }}
          />
        </div>
        <Button
          size="xs"
          variant="outline"
          disabled={busy || trimmedSource.length === 0}
          onClick={() => void find()}
        >
          {busy && found === null ? "Looking…" : "Find skills"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Skills are instructions your agents follow and may include scripts they run. Install only
        from sources you trust.
      </p>
      {found === null ? null : (
        <div className="space-y-1.5">
          {found.map((skill) => (
            <label key={skill.path} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={selected.has(skill.path)}
                onCheckedChange={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked === true) next.add(skill.path);
                    else next.delete(skill.path);
                    return next;
                  })
                }
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  {skill.name}
                  {skill.installed ? <Badge variant="outline">Installed</Badge> : null}
                </span>
                {skill.description === undefined ? null : (
                  <span className="block text-xs text-muted-foreground wrap-anywhere">
                    {skill.description}
                  </span>
                )}
              </span>
            </label>
          ))}
          {found.some((skill) => skill.installed) ? (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={replace}
                onCheckedChange={(checked) => setReplace(checked === true)}
              />
              Replace installed skills (the old ones go to the trash)
            </label>
          ) : null}
        </div>
      )}
      {problem === null ? null : (
        <p className="whitespace-pre-wrap text-xs text-destructive wrap-anywhere">{problem}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </Button>
        {found === null ? null : (
          <Button
            size="xs"
            disabled={busy || selected.size === 0}
            onClick={() => void installSelected()}
          >
            {busy ? "Installing…" : `Install ${selected.size}`}
          </Button>
        )}
      </div>
    </div>
  );
}
