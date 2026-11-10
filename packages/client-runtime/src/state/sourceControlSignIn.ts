import type { EnvironmentId, SourceControlDiscoveryResult } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";

export interface SourceControlSignInSummary {
  /** Connected environments whose GitHub is known not to be signed in. */
  readonly githubSignedOut: ReadonlySet<EnvironmentId>;
  /** Issues and Releases only read GitHub, so they hide when no environment has it signed in. */
  readonly issuesHidden: boolean;
  /** Pull requests work with any provider, so they hide only when none is signed in anywhere. */
  readonly pullRequestsHidden: boolean;
}

const signedIn = (item: SourceControlDiscoveryResult["sourceControlProviders"][number]) =>
  item.status === "available" && item.auth.status !== "unauthenticated";

/** An environment whose discovery hasn't loaded counts as signed in, so panels don't flicker away. */
export function summarizeSourceControlSignIn(
  discoveries: ReadonlyMap<EnvironmentId, SourceControlDiscoveryResult | null>,
): SourceControlSignInSummary {
  const githubSignedOut = new Set<EnvironmentId>();
  let githubEnvironments = 0;
  let providerEnvironments = 0;
  for (const [environmentId, discovery] of discoveries) {
    const providers = discovery?.sourceControlProviders;
    if (providers === undefined) {
      githubEnvironments += 1;
      providerEnvironments += 1;
      continue;
    }
    if (providers.some((item) => item.kind === "github" && signedIn(item))) githubEnvironments += 1;
    else githubSignedOut.add(environmentId);
    if (providers.some(signedIn)) providerEnvironments += 1;
  }
  return {
    githubSignedOut,
    issuesHidden: discoveries.size > 0 && githubEnvironments === 0,
    pullRequestsHidden: discoveries.size > 0 && providerEnvironments === 0,
  };
}

export function createSourceControlSignInAtom(input: {
  readonly connectedEnvironmentIdsAtom: Atom.Atom<ReadonlyArray<EnvironmentId>>;
  readonly discovery: (query: {
    readonly environmentId: EnvironmentId;
    readonly input: Record<string, never>;
  }) => Atom.Atom<AsyncResult.AsyncResult<SourceControlDiscoveryResult, unknown>>;
}) {
  return Atom.make((get) =>
    summarizeSourceControlSignIn(
      new Map(
        get(input.connectedEnvironmentIdsAtom).map((environmentId) => [
          environmentId,
          AsyncResult.getOrElse(get(input.discovery({ environmentId, input: {} })), () => null),
        ]),
      ),
    ),
  ).pipe(Atom.withLabel("source-control-sign-in"));
}
