import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, MemoryImportScanResult, ProjectId } from "@t3tools/contracts";
import { useState } from "react";

import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  entryKey,
  importProblem,
  matchProject,
  planImport,
  type ImportProblem,
} from "./memoryImport.logic";

const NO_PROJECT = "none";

const PROBLEM_TEXT: Record<ImportProblem, string> = {
  too_long: "Too long (over 2000 characters): split it first",
  needs_project: "Choose a project for it",
};

export function MemoryImportDialog({
  environmentId,
  projects,
  open,
  onOpenChange,
  onImported,
}: {
  readonly environmentId: EnvironmentId;
  readonly projects: ReadonlyArray<{
    readonly id: ProjectId;
    readonly title: string;
    readonly workspaceRoot: string;
  }>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onImported: () => void;
}) {
  const scan = useAtomCommand(serverEnvironment.scanClaudeMemories, {
    label: "memory import scan",
  });
  const save = useAtomCommand(serverEnvironment.saveMemory, { label: "memory import" });
  const [path, setPath] = useState("");
  const [scanned, setScanned] = useState<MemoryImportScanResult | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [projectByDirectory, setProjectByDirectory] = useState<Record<string, ProjectId | null>>(
    {},
  );
  const [busy, setBusy] = useState(false);

  const fail = (title: string, result: Parameters<typeof squashAtomCommandFailure>[0]) =>
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title,
        description: String(squashAtomCommandFailure(result)),
      }),
    );

  const runScan = async () => {
    setBusy(true);
    const result = await scan({
      environmentId,
      input: path.trim() === "" ? {} : { path: path.trim() },
    });
    setBusy(false);
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) fail("Could not read Claude's memories", result);
      return;
    }
    const groups = result.value.groups;
    const mapping: Record<string, ProjectId | null> = {};
    const initial = new Set<string>();
    for (const group of groups) {
      mapping[group.directory] = matchProject(group.directory, projects);
      for (const entry of group.entries)
        if (importProblem(entry, mapping[group.directory] ?? null) === null)
          initial.add(entryKey(group.directory, entry.file));
    }
    setScanned(result.value);
    setProjectByDirectory(mapping);
    setSelected(initial);
  };

  const plan = scanned === null ? null : planImport(scanned.groups, selected, projectByDirectory);

  const runImport = async () => {
    if (plan === null) return;
    setBusy(true);
    let saved = 0;
    for (const item of plan.items) {
      const result = await save({
        environmentId,
        input: {
          scope: item.scope,
          ...(item.projectId === undefined ? {} : { projectId: item.projectId }),
          text: item.text,
        },
      });
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result)) fail(`Imported ${saved}, then stopped`, result);
        break;
      }
      saved += 1;
    }
    setBusy(false);
    if (saved > 0) onImported();
    if (saved === plan.items.length) {
      toastManager.add(
        stackedThreadToast({ type: "success", title: `Imported ${saved} memories` }),
      );
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-h-[80dvh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Claude's memories</DialogTitle>
          <DialogDescription>
            Reads the memory folders Claude Code keeps on this environment's disk. Personal notes
            (user, feedback) import as All projects; project notes need a project. Nothing is
            changed in Claude's files, and a note already saved is not added twice.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-1">
              <Input
                size="sm"
                aria-label="Folder with Claude's project folders"
                placeholder="~/.claude/projects"
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
            </div>
            <Button size="xs" variant="outline" disabled={busy} onClick={() => void runScan()}>
              {scanned === null ? "Scan" : "Scan again"}
            </Button>
          </div>
          {scanned !== null && scanned.groups.length === 0 ? (
            <p className="pt-3 text-sm text-muted-foreground">
              No memory files under {scanned.path}.
            </p>
          ) : null}
          {scanned?.groups.map((group) => {
            const project = projectByDirectory[group.directory] ?? null;
            return (
              <section key={group.directory} className="space-y-1.5 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {group.directory}
                  </code>
                  <Select
                    value={project ?? NO_PROJECT}
                    onValueChange={(value) =>
                      setProjectByDirectory((current) => ({
                        ...current,
                        [group.directory]: value === NO_PROJECT ? null : (value as ProjectId),
                      }))
                    }
                  >
                    <div className="grid w-52 shrink-0 grid-cols-1">
                      <SelectTrigger size="sm" aria-label={`Project for ${group.directory}`}>
                        <SelectValue>
                          {project === null
                            ? "No project"
                            : (projects.find((entry) => entry.id === project)?.title ?? "Project")}
                        </SelectValue>
                      </SelectTrigger>
                    </div>
                    <SelectPopup>
                      <SelectItem value={NO_PROJECT}>No project</SelectItem>
                      {projects.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.title}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                {group.entries.map((entry) => {
                  const key = entryKey(group.directory, entry.file);
                  const problem = importProblem(entry, project);
                  return (
                    <label key={key} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={selected.has(key) && problem === null}
                        disabled={problem !== null}
                        onCheckedChange={(checked) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (checked) next.add(key);
                            else next.delete(key);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium wrap-anywhere">{entry.name}</span>
                          {entry.kind === null ? null : (
                            <Badge variant="outline">{entry.kind}</Badge>
                          )}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground wrap-anywhere">
                          {entry.text}
                        </span>
                        {problem === null ? null : (
                          <span className="text-xs text-destructive">{PROBLEM_TEXT[problem]}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </section>
            );
          })}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button
            disabled={busy || plan === null || plan.items.length === 0}
            onClick={() => void runImport()}
          >
            {plan === null || plan.items.length === 0 ? "Import" : `Import ${plan.items.length}`}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
