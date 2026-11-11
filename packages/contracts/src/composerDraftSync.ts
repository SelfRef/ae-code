import * as Schema from "effect/Schema";

import { EnvironmentAuthorizationError } from "./auth.ts";
import {
  ForwardCompatibleArray,
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import { ComposerContextRecord } from "./composerContext.ts";
import { ModelSelection } from "./modelSelection.ts";
import { ProviderInteractionMode, RuntimeMode } from "./providerPolicy.ts";

export const COMPOSER_DRAFT_MAX_LIVE = 500;
export const COMPOSER_DRAFT_MAX_PAYLOAD_BYTES = 256 * 1024;
const COMPOSER_DRAFT_PUT_MAX = 32;
export const COMPOSER_DRAFT_TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** `thread:<threadId>` for a thread's unsent message, `draft:<draftId>` for a new-thread draft. */
export const ComposerDraftKey = TrimmedNonEmptyString.check(
  Schema.isMaxLength(200),
  Schema.isPattern(/^(thread|draft):\S+$/),
);
export type ComposerDraftKey = typeof ComposerDraftKey.Type;

/** What a new-thread draft remembers beyond its text; the environment is the server it lives on. */
export const SyncedComposerDraftSession = Schema.Struct({
  projectId: ProjectId,
  threadId: Schema.optional(ThreadId),
  branch: Schema.NullOr(Schema.String),
  worktreePath: Schema.NullOr(Schema.String),
  envMode: Schema.Literals(["local", "worktree"]),
  startFromOrigin: Schema.optional(Schema.Boolean),
  createdAt: IsoDateTime,
  pullRequestReference: Schema.optional(Schema.String),
  followsCurrentCheckout: Schema.optional(Schema.Boolean),
});
export type SyncedComposerDraftSession = typeof SyncedComposerDraftSession.Type;

/** The part of a draft a client writes; the server adds the revision and who wrote it. */
export const ComposerDraftContent = Schema.Struct({
  prompt: Schema.String,
  /** Images and files are listed by attachment id: the bytes stay on the server. */
  records: ForwardCompatibleArray(ComposerContextRecord),
  modelSelection: Schema.NullOr(ModelSelection),
  runtimeMode: Schema.NullOr(RuntimeMode),
  interactionMode: Schema.NullOr(ProviderInteractionMode),
  session: Schema.NullOr(SyncedComposerDraftSession),
});
export type ComposerDraftContent = typeof ComposerDraftContent.Type;

/** A tombstone has no content; `promotedTo` names the thread a sent new-thread draft became. */
export const SyncedComposerDraft = Schema.Struct({
  key: ComposerDraftKey,
  revision: NonNegativeInt,
  updatedAt: IsoDateTime,
  /** The `clientId` of the writer, so it can skip its own echo. */
  updatedBy: Schema.String,
  deleted: Schema.Boolean,
  promotedTo: Schema.NullOr(ThreadId),
  content: Schema.NullOr(ComposerDraftContent),
});
export type SyncedComposerDraft = typeof SyncedComposerDraft.Type;

export const ComposerDraftWrite = Schema.Struct({
  key: ComposerDraftKey,
  deleted: Schema.Boolean,
  promotedTo: Schema.optional(ThreadId),
  content: Schema.optional(ComposerDraftContent),
});
export type ComposerDraftWrite = typeof ComposerDraftWrite.Type;

export const ComposerDraftsPutInput = Schema.Struct({
  clientId: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  writes: Schema.Array(ComposerDraftWrite).check(Schema.isMaxLength(COMPOSER_DRAFT_PUT_MAX)),
});
export type ComposerDraftsPutInput = typeof ComposerDraftsPutInput.Type;

export const ComposerDraftsPutResult = Schema.Struct({
  revisions: Schema.Array(Schema.Struct({ key: ComposerDraftKey, revision: NonNegativeInt })),
});
export type ComposerDraftsPutResult = typeof ComposerDraftsPutResult.Type;

export const ComposerDraftsStreamEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("snapshot"), drafts: Schema.Array(SyncedComposerDraft) }),
  Schema.Struct({ type: Schema.Literal("upsert"), drafts: Schema.Array(SyncedComposerDraft) }),
]);
export type ComposerDraftsStreamEvent = typeof ComposerDraftsStreamEvent.Type;

export class ComposerDraftError extends Schema.TaggedError<ComposerDraftError>()(
  "ComposerDraftError",
  {
    code: Schema.Literals(["invalid", "limit", "unavailable"]),
    message: Schema.String,
  },
) {}

export const ComposerDraftRpcError = Schema.Union([
  ComposerDraftError,
  EnvironmentAuthorizationError,
]);
