import { useAtomValue } from "@effect/atom-react";
import { createSourceControlEnvironmentAtoms } from "@t3tools/client-runtime/state/source-control";
import { createSourceControlSignInAtom } from "@t3tools/client-runtime/state/source-control-sign-in";

import { connectionAtomRuntime } from "../connection/runtime";
import { connectedEnvironmentIdsAtom } from "./presentation";

export const sourceControlEnvironment = createSourceControlEnvironmentAtoms(connectionAtomRuntime);

export const sourceControlSignInAtom = createSourceControlSignInAtom({
  connectedEnvironmentIdsAtom,
  discovery: sourceControlEnvironment.discovery,
});

/** What the sign-in status of the connected environments hides: Issues, Releases, Pull requests. */
export function useSourceControlSignIn() {
  return useAtomValue(sourceControlSignInAtom);
}
