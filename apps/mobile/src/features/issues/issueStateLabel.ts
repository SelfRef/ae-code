import type { IssueSummary } from "@t3tools/contracts";

export function issueStateLabel(issue: Pick<IssueSummary, "state" | "stateReason">): string {
  if (issue.state === "open") return "Open";
  return issue.stateReason === "not-planned" ? "Not planned" : "Closed";
}
