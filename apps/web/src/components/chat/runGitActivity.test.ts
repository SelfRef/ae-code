import { RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import { type TimelineEntry } from "../../session-logic";
import { deriveRunGitActivity } from "./runGitActivity";

const runId = RunId.make("git-run");

function command(
  rawCommand: string,
  status: "completed" | "failed" | "inProgress" = "completed",
): TimelineEntry {
  const at = "2026-11-10T00:00:00Z";
  return {
    kind: "work",
    id: rawCommand,
    createdAt: at,
    entry: {
      id: rawCommand,
      runId,
      createdAt: at,
      itemType: "command_execution",
      tone: "tool",
      label: "Ran command",
      rawCommand,
      toolLifecycleStatus: status,
    },
  };
}

describe("deriveRunGitActivity", () => {
  it.each([
    ["git commit -m 'feat: x'", { commits: 1, pushed: false }],
    ["git -C /repo commit --amend --no-edit", { commits: 1, pushed: false }],
    ["git add -A && git commit -m x && git push origin main", { commits: 1, pushed: true }],
    ["git push --force-with-lease=main:abc origin main", { commits: 0, pushed: true }],
  ])("reads %s", (input, expected) => {
    expect(deriveRunGitActivity([command(input)]).get(runId)).toEqual(expected);
  });

  it.each([
    ["a failed commit", command("git commit -m x", "failed")],
    ["a command still running", command("git push", "inProgress")],
    ["a dry run", command("git push --dry-run")],
    ["other git commands", command("git status && git log --oneline")],
    ["a commit word in another tool", command("echo commit && grep git file")],
  ])("ignores %s", (_name, entry) => {
    expect(deriveRunGitActivity([entry]).get(runId)).toBeUndefined();
  });

  it("counts every successful commit of the run", () => {
    expect(
      deriveRunGitActivity([command("git commit -m a"), command("git commit -m b")]).get(runId),
    ).toEqual({ commits: 2, pushed: false });
  });
});
