import type { CommandId, ThreadId } from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import * as Effect from "effect/Effect";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import * as ServerSettings from "../serverSettings.ts";

/** Settles a thread after its branch was merged into the default branch, if its project says so. */
export const settleAfterMerge = Effect.fn("GitManager.settleAfterMerge")(function* (input: {
  readonly threadId: ThreadId;
  readonly commandId: CommandId;
  /** The merge ran inside the thread's own turn, so the thread settles when that turn ends. */
  readonly byOwnAgent: boolean;
}) {
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const serverSettings = yield* ServerSettings.ServerSettingsService;
  const shell = yield* threads.getThreadShell(input.threadId);
  if (shell === null) return;
  const { settings } = resolveProjectSettings(yield* serverSettings.getSettings, shell.projectId);
  if (!settings.settleAfterMerge) return;
  yield* threads.settleThread(input);
});
