import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { useComposerDraft } from "../../state/use-composer-drafts";

/** Text or attachments waiting in the thread's composer. */
export function useThreadHasUnsentDraft(thread: EnvironmentThreadShell): boolean {
  const draft = useComposerDraft(
    scopedThreadKey({ environmentId: thread.environmentId, threadId: thread.id }),
  );
  return draft.text.trim().length > 0 || draft.attachments.length > 0;
}
