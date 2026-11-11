import { createComposerDraftEnvironmentAtoms } from "@t3tools/client-runtime/state/composer-drafts";

import { connectionAtomRuntime } from "../connection/runtime";

export const composerDraftEnvironment = createComposerDraftEnvironmentAtoms(connectionAtomRuntime);
