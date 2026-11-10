import * as Schema from "effect/Schema";

import {
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import { PullRequestActor } from "./pullRequest.ts";

export const RELEASE_LIST_PAGE_SIZE = 30;

export const ReleaseListInput = Schema.Struct({
  projectId: ProjectId,
  /** 1-based; each page holds `RELEASE_LIST_PAGE_SIZE` releases. */
  page: Schema.optional(PositiveInt),
});
export type ReleaseListInput = typeof ReleaseListInput.Type;

export const ReleaseSummary = Schema.Struct({
  id: PositiveInt,
  tagName: TrimmedNonEmptyString,
  /** Empty when the release has no title of its own; show the tag then. */
  name: Schema.String,
  url: Schema.String,
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
  author: Schema.NullOr(PullRequestActor),
  createdAt: IsoDateTime,
  /** Null for a draft. */
  publishedAt: Schema.NullOr(IsoDateTime),
});
export type ReleaseSummary = typeof ReleaseSummary.Type;

export const ReleaseListResult = Schema.Struct({
  /** `owner/name` of the repository the releases were read from. */
  repository: Schema.String,
  host: Schema.String,
  releases: Schema.Array(ReleaseSummary),
  hasMore: Schema.Boolean,
});
export type ReleaseListResult = typeof ReleaseListResult.Type;

export const ReleaseReadInput = Schema.Struct({
  projectId: ProjectId,
  id: PositiveInt,
});
export type ReleaseReadInput = typeof ReleaseReadInput.Type;

export const ReleaseAsset = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  size: NonNegativeInt,
  downloadCount: NonNegativeInt,
});
export type ReleaseAsset = typeof ReleaseAsset.Type;

export const ReleaseDetail = Schema.Struct({
  ...ReleaseSummary.fields,
  repository: Schema.String,
  /** Branch or commit the tag was created from; empty when GitHub does not say. */
  targetCommitish: Schema.String,
  body: Schema.String,
  assets: Schema.Array(ReleaseAsset),
});
export type ReleaseDetail = typeof ReleaseDetail.Type;
