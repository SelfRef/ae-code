import { WS_METHODS } from "@t3tools/contracts";
import * as Stream from "effect/Stream";
import { Atom } from "effect/reactivity";

import { type DraftsByKey, reduceComposerDraftEvent } from "../composerDraftSync.ts";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";

const NO_DRAFTS: DraftsByKey = {};

export function createComposerDraftEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    /** Every draft of an environment, kept current while the connection lives. */
    drafts: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:composer-drafts:stream",
      tag: WS_METHODS.composerDraftsSubscribe,
      // `scan` emits its seed first; skipping it keeps the atom empty until the snapshot arrives.
      transform: (events) =>
        events.pipe(
          Stream.scan(() => NO_DRAFTS, reduceComposerDraftEvent),
          Stream.filter((drafts) => drafts !== NO_DRAFTS),
        ),
    }),
    put: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:composer-drafts:put",
      tag: WS_METHODS.composerDraftsPut,
    }),
  };
}
