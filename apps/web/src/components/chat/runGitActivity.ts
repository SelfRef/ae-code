import { type RunId } from "@t3tools/contracts";
import { workEntryIndicatesToolFailure, type TimelineEntry } from "../../session-logic";

export interface RunGitActivity {
  readonly commits: number;
  readonly pushed: boolean;
}

// `git [-C dir | -c k=v | --flag]... commit|push`, at the start of the command or after a shell separator.
const GIT_COMMAND =
  /(?:^|[\s;&|(])git(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?|-[a-zA-Z]))*\s+(commit|push)\b([^;&|\n]*)/g;

/** Successful `git commit` and `git push` commands the agent ran, per run. */
export function deriveRunGitActivity(
  entries: ReadonlyArray<TimelineEntry>,
): ReadonlyMap<RunId, RunGitActivity> {
  const byRun = new Map<RunId, { commits: number; pushed: boolean }>();
  for (const timelineEntry of entries) {
    if (timelineEntry.kind !== "work") continue;
    const { entry } = timelineEntry;
    const command = entry.rawCommand;
    if (
      entry.itemType !== "command_execution" ||
      !entry.runId ||
      command === undefined ||
      (entry.toolLifecycleStatus !== undefined && entry.toolLifecycleStatus !== "completed") ||
      workEntryIndicatesToolFailure(entry)
    ) {
      continue;
    }
    for (const match of command.matchAll(GIT_COMMAND)) {
      if (/--dry-run/.test(match[2] ?? "")) continue;
      const activity = byRun.get(entry.runId) ?? { commits: 0, pushed: false };
      if (match[1] === "commit") activity.commits += 1;
      else activity.pushed = true;
      byRun.set(entry.runId, activity);
    }
  }
  return byRun;
}
