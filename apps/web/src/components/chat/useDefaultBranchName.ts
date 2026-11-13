import type { EnvironmentId } from "@t3tools/contracts";

import { useEnvironmentQuery } from "../../state/query";
import { vcsEnvironment } from "../../state/vcs";

/** The default branch's name, fetched only while `enabled`. The current branch comes first and the default next, so two refs include it. */
export function useDefaultBranchName(
  environmentId: EnvironmentId,
  cwd: string | null,
  enabled: boolean,
): string | undefined {
  return useEnvironmentQuery(
    cwd !== null && enabled
      ? vcsEnvironment.listRefs({
          environmentId,
          input: { cwd, refKind: "local", limit: 2 },
        })
      : null,
  ).data?.refs.find((ref) => ref.isDefault)?.name;
}
