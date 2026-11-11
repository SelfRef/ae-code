import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import { describe, expect, it } from "vite-plus/test";
import {
  buildThreadSwitcherThreads,
  type BreadcrumbSwitcherThread,
} from "./breadcrumbSwitcher.logic";

function makeThread(
  id: string,
  overrides: Partial<BreadcrumbSwitcherThread> = {},
): BreadcrumbSwitcherThread {
  const threadId = ThreadId.make(id);
  return {
    environmentId: EnvironmentId.make("environment-a"),
    id: threadId,
    projectId: ProjectId.make("project-a"),
    title: id,
    lineage: {
      parentThreadId: null,
      relationshipToParent: null,
      rootThreadId: threadId,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    latestUserMessageAt: null,
    archivedAt: null,
    deletedAt: null,
    pinnedAt: null,
    pinOrderKey: null,
    ...overrides,
  };
}

describe("buildThreadSwitcherThreads", () => {
  it("limits threads to scoped project refs across environments", () => {
    const local = makeThread("local");
    const remote = makeThread("remote", {
      environmentId: EnvironmentId.make("environment-b"),
      projectId: ProjectId.make("project-b"),
    });
    const sameProjectIdElsewhere = makeThread("same-project-id-elsewhere", {
      environmentId: remote.environmentId,
    });
    const otherProject = makeThread("other-project", { projectId: remote.projectId });

    expect(
      buildThreadSwitcherThreads({
        threads: [sameProjectIdElsewhere, local, otherProject, remote],
        projectRefs: [
          scopeProjectRef(local.environmentId, local.projectId),
          scopeProjectRef(remote.environmentId, remote.projectId),
        ],
        hiddenThreadKeys: new Set(),
        sortOrder: "updated_at",
        currentThreadRef: null,
      }),
    ).toEqual([remote, local]);
  });

  it.each([
    ["archived", { archivedAt: "2026-01-02T00:00:00.000Z" }],
    ["deleted", { deletedAt: "2026-01-02T00:00:00.000Z" }],
    ["hidden", {}],
    [
      "subagent",
      {
        lineage: {
          parentThreadId: ThreadId.make("parent"),
          relationshipToParent: "subagent",
          rootThreadId: ThreadId.make("parent"),
        },
      },
    ],
    [
      "side chat",
      {
        lineage: {
          parentThreadId: null,
          relationshipToParent: null,
          rootThreadId: ThreadId.make("excluded"),
          sideChat: true,
        },
      },
    ],
  ] as const)("drops %s threads", (reason, overrides) => {
    const listed = makeThread("listed");
    const excluded = makeThread("excluded", overrides);
    const excludedKey = threadKey(scopeThreadRef(excluded.environmentId, excluded.id));

    expect(
      buildThreadSwitcherThreads({
        threads: [listed, excluded],
        projectRefs: [scopeProjectRef(listed.environmentId, listed.projectId)],
        hiddenThreadKeys: new Set(reason === "hidden" ? [excludedKey] : []),
        sortOrder: "updated_at",
        currentThreadRef: null,
      }),
    ).toEqual([listed]);
  });

  it("keeps the current archived thread without retaining other archived threads", () => {
    const current = makeThread("current", { archivedAt: "2026-01-02T00:00:00.000Z" });
    const other = makeThread("other", { archivedAt: current.archivedAt });

    expect(
      buildThreadSwitcherThreads({
        threads: [other, current],
        projectRefs: [scopeProjectRef(current.environmentId, current.projectId)],
        hiddenThreadKeys: new Set(),
        sortOrder: "updated_at",
        currentThreadRef: scopeThreadRef(current.environmentId, current.id),
      }),
    ).toEqual([current]);
  });

  it("orders pins by their order keys before threads sorted by user activity", () => {
    const firstPin = makeThread("first-pin", {
      pinnedAt: "2026-01-04T00:00:00.000Z",
      pinOrderKey: "b",
    });
    const secondPin = makeThread("second-pin", {
      pinnedAt: "2026-01-02T00:00:00.000Z",
      pinOrderKey: "n",
      latestUserMessageAt: "2026-01-05T00:00:00.000Z",
    });
    const newer = makeThread("newer", {
      latestUserMessageAt: "2026-01-04T00:00:00.000Z",
    });
    const older = makeThread("older", {
      latestUserMessageAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-06T00:00:00.000Z",
    });
    const fallback = makeThread("fallback", { updatedAt: "2026-01-03T00:00:00.000Z" });

    expect(
      buildThreadSwitcherThreads({
        threads: [older, secondPin, fallback, newer, firstPin],
        projectRefs: [scopeProjectRef(firstPin.environmentId, firstPin.projectId)],
        hiddenThreadKeys: new Set(),
        sortOrder: "updated_at",
        currentThreadRef: null,
      }),
    ).toEqual([firstPin, secondPin, newer, fallback, older]);
  });
});
