import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

export function createIssueEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    list: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:issues:list",
      tag: WS_METHODS.issuesList,
      staleTimeMs: 30_000,
    }),
    detail: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:issues:detail",
      tag: WS_METHODS.issuesRead,
      staleTimeMs: 30_000,
    }),
    releaseList: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:releases:list",
      tag: WS_METHODS.releasesList,
      staleTimeMs: 30_000,
    }),
    releaseDetail: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:releases:detail",
      tag: WS_METHODS.releasesRead,
      staleTimeMs: 30_000,
    }),
  };
}
