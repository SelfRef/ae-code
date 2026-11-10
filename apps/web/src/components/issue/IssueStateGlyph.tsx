import type { IssueSummary } from "@t3tools/contracts";
import { CircleCheckIcon, CircleDotIcon, CircleSlashIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export function IssueStateGlyph({
  issue,
  className,
}: {
  issue: Pick<IssueSummary, "state" | "stateReason">;
  className?: string;
}) {
  if (issue.state === "open") {
    return <CircleDotIcon className={cn("size-4 text-success-foreground", className)} />;
  }
  return issue.stateReason === "not-planned" ? (
    <CircleSlashIcon className={cn("size-4 text-muted-foreground", className)} />
  ) : (
    <CircleCheckIcon className={cn("size-4 text-info-foreground", className)} />
  );
}
