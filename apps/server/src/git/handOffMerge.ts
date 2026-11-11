import { CommandId, MessageId, type ModelSelection, type ThreadId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { modelSelectionsEqual } from "@t3tools/shared/model";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";

const WAIT_MS = Duration.toMillis(Duration.hours(1));

/** What the thread's agent is told when the built-in merge could not finish. */
function mergeHandOffPrompt(input: { readonly push: boolean; readonly error: string }) {
  return [
    `Merging this branch into the default branch${input.push ? " and pushing it" : ""} failed:`,
    "",
    input.error,
    "",
    "Finish the merge yourself:",
    "1. Commit any pending changes in this checkout.",
    "2. Rebase this branch onto the default branch and resolve any conflicts, keeping the intent of both sides. Run the project's checks afterwards.",
    "3. Fast-forward the default branch to this branch (`git merge --ff-only` in the checkout that has the default branch checked out, or `git fetch . <branch>:<default>` when none has).",
    ...(input.push ? ["4. Push the default branch to its remote."] : []),
    "",
    "Keep the history linear: no merge commits, no force-push, and never discard uncommitted work in the default branch's checkout. If a step cannot be done safely, stop and say why.",
  ].join("\n");
}

/**
 * Hands a failed merge to the thread's agent as a system notice, the way compaction runs as its
 * own turn, and resolves once that turn ends. False when the agent could not be started.
 * A `modelSelection` is for this turn only: the thread's own model is put back afterwards.
 */
export const handOffMerge = Effect.fn("handOffMerge")(
  function* (input: {
    readonly threadId: ThreadId;
    readonly push: boolean;
    readonly error: string;
    /** Absent runs the thread's own model. */
    readonly modelSelection?: ModelSelection | undefined;
    readonly uuid: string;
  }) {
    const threads = yield* ThreadManagementService.ThreadManagementService;
    const thread = Option.fromNullishOr(yield* threads.getThreadShell(input.threadId));
    if (Option.isNone(thread)) return false;
    const text = mergeHandOffPrompt(input);
    yield* threads.dispatch({
      type: "message.dispatch",
      commandId: CommandId.make(`server:merge-hand-off:${input.uuid}`),
      messageId: MessageId.make(`message:merge-hand-off:${input.uuid}`),
      threadId: input.threadId,
      text,
      notification: {
        source: { kind: "system" },
        outcome: "updated",
        summary: input.push ? "Merging and pushing by the agent" : "Merging by the agent",
        detail: text,
      },
      attachments: [],
      ...(input.modelSelection === undefined ? {} : { modelSelection: input.modelSelection }),
      createdBy: "agent",
      creationSource: "server",
      dispatchMode: { type: "queue_after_active" },
    });
    // The turn switched the thread's model; put it back unless someone picked another meanwhile.
    const restoreModel = Effect.gen(function* () {
      const override = input.modelSelection;
      if (override === undefined || modelSelectionsEqual(override, thread.value.modelSelection)) {
        return;
      }
      const now = yield* threads.getThreadShell(input.threadId);
      if (now === null || !modelSelectionsEqual(now.modelSelection, override)) {
        return;
      }
      yield* threads.dispatch({
        type: "thread.model-selection.set",
        commandId: CommandId.make(`server:merge-hand-off:${input.uuid}:restore-model`),
        threadId: input.threadId,
        modelSelection: thread.value.modelSelection,
      });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("failed to restore the thread's model after a merge", { cause }),
      ),
    );
    yield* threads
      .waitForThread({
        projectId: thread.value.projectId,
        threadId: input.threadId,
        timeoutMs: WAIT_MS,
      })
      .pipe(Effect.ensuring(restoreModel));
    return true;
  },
  (effect) =>
    effect.pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause as Cause.Cause<never>)
          : Effect.logWarning("failed to hand a merge to the agent", { cause }).pipe(
              Effect.as(false),
            ),
      ),
    ),
);
