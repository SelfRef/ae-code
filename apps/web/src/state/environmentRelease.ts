import type { EnvironmentId } from "@t3tools/contracts";
import { compareSemverVersions } from "@t3tools/shared/semver";
import { AsyncResult, Atom } from "effect/reactivity";

import { environmentAtomList } from "./environmentAtomList";
import { serverEnvironment } from "./server";

/** The newest release the environment's own server finds on GitHub, null until known or when it cannot check. */
export const environmentLatestReleaseAtom = Atom.family((environmentId: EnvironmentId) =>
  Atom.make((get) => {
    const result = get(serverEnvironment.npmRelease({ environmentId, input: { spec: "latest" } }));
    return AsyncResult.isSuccess(result) ? (result.value?.version ?? null) : null;
  }).pipe(Atom.withLabel(`environment-latest-release:${environmentId}`)),
);

export const environmentLatestReleasesAtom = environmentAtomList(
  "web-environment-latest-releases",
  environmentLatestReleaseAtom,
);

/** The release to update to, or null when the server already runs it or a newer build. */
export function releaseUpdateTarget(
  serverVersion: string | null | undefined,
  latest: string | null,
): string | null {
  return serverVersion && latest !== null && compareSemverVersions(latest, serverVersion) > 0
    ? latest
    : null;
}
