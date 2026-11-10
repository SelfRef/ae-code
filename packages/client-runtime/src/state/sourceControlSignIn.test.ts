import type { EnvironmentId, SourceControlDiscoveryResult } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { summarizeSourceControlSignIn } from "./sourceControlSignIn.ts";

const environment = (id: string) => id as EnvironmentId;

const provider = (
  kind: string,
  status: "available" | "missing",
  auth: "authenticated" | "unauthenticated" | "unknown",
) => ({ kind, status, auth: { status: auth } });

const discovery = (...providers: ReturnType<typeof provider>[]) =>
  ({
    versionControlSystems: [],
    sourceControlProviders: providers,
  }) as unknown as SourceControlDiscoveryResult;

describe("summarizeSourceControlSignIn", () => {
  it("hides Issues and Releases when GitHub is signed out, but keeps Pull requests while another provider is signed in", () => {
    const summary = summarizeSourceControlSignIn(
      new Map([
        [
          environment("a"),
          discovery(
            provider("github", "available", "unauthenticated"),
            provider("forgejo", "available", "authenticated"),
          ),
        ],
      ]),
    );
    expect(summary.issuesHidden).toBe(true);
    expect(summary.pullRequestsHidden).toBe(false);
    expect([...summary.githubSignedOut]).toEqual(["a"]);
  });

  it("hides Pull requests only when no provider is signed in on any environment", () => {
    const summary = summarizeSourceControlSignIn(
      new Map([
        [environment("a"), discovery(provider("github", "missing", "unknown"))],
        [environment("b"), discovery(provider("gitlab", "available", "unauthenticated"))],
      ]),
    );
    expect(summary.issuesHidden).toBe(true);
    expect(summary.pullRequestsHidden).toBe(true);
  });

  it("keeps panels while one environment has GitHub, while discovery loads, and with nothing connected", () => {
    expect(
      summarizeSourceControlSignIn(
        new Map([
          [environment("a"), discovery(provider("github", "available", "unauthenticated"))],
          [environment("b"), discovery(provider("github", "available", "unknown"))],
        ]),
      ).issuesHidden,
    ).toBe(false);
    expect(summarizeSourceControlSignIn(new Map([[environment("a"), null]]))).toMatchObject({
      issuesHidden: false,
      pullRequestsHidden: false,
    });
    expect(summarizeSourceControlSignIn(new Map())).toMatchObject({
      issuesHidden: false,
      pullRequestsHidden: false,
    });
  });
});
