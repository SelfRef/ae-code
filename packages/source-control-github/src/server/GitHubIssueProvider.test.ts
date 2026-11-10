import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as GitHubIssueProvider from "./GitHubIssueProvider.ts";
import * as GitHubRequestPolicy from "./GitHubRequestPolicy.ts";
import * as GitHubRest from "./GitHubRest.ts";

const issue = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/o/r/issues/${number}`,
  state: "open",
  user: { login: "ada", avatar_url: "https://avatars/ada", type: "User" },
  assignees: [{ login: "bot", type: "Bot" }],
  labels: [{ name: "bug", color: "d73a4a" }, "plain"],
  comments: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  closed_at: null,
  ...extra,
});

const respond = (body: unknown) =>
  Effect.succeed({
    status: 200,
    headers: {},
    body: JSON.stringify(body),
    truncated: false,
    invalidUtf8: false,
  });

describe("GitHubIssueProvider", () => {
  it.effect("lists issues through search, leaving out pull requests", () => {
    const paths: Array<string> = [];
    const api = Layer.mock(GitHubRest.GitHubRest)({
      rest: (input) => {
        paths.push(input.path);
        return respond({
          total_count: 120,
          items: [
            issue(3, {
              state: "closed",
              state_reason: "not_planned",
              closed_at: "2026-01-03T00:00:00Z",
            }),
            issue(2, { pull_request: {} }),
            issue(1),
          ],
        });
      },
    });
    return Effect.gen(function* () {
      const provider = yield* GitHubIssueProvider.make;
      const page = yield* provider.listIssues({
        host: "github.com",
        repository: "o/r",
        state: "closed",
        query: "crash",
        page: 1,
        pageSize: 50,
      });
      assert.deepStrictEqual(
        page.issues.map((entry) => [entry.number, entry.state, entry.stateReason]),
        [
          [3, "closed", "not-planned"],
          [1, "open", null],
        ],
      );
      assert.deepStrictEqual(page.issues[1]?.labels, [
        { name: "bug", color: "d73a4a" },
        { name: "plain", color: null },
      ]);
      assert.isTrue(page.hasMore);
      assert.strictEqual(
        decodeURIComponent(paths[0] ?? ""),
        "search/issues?q=repo:o/r is:issue is:closed crash&sort=updated&order=desc&per_page=50&page=1",
      );
    }).pipe(Effect.provide(api));
  });

  it.effect("reads an issue with its comments and refuses a pull request", () => {
    const api = Layer.mock(GitHubRest.GitHubRest)({
      rest: (input) =>
        input.path.endsWith("/comments?per_page=100")
          ? respond([
              {
                id: 7,
                html_url: "https://github.com/o/r/issues/5#issuecomment-7",
                user: { login: "grace" },
                body: "me too",
                created_at: "2026-01-02T00:00:00Z",
                updated_at: "2026-01-03T00:00:00Z",
              },
            ])
          : respond(
              input.path.endsWith("/issues/6")
                ? issue(6, { pull_request: {} })
                : issue(5, { body: "It crashes", comments: 3 }),
            ),
    });
    return Effect.gen(function* () {
      const provider = yield* GitHubIssueProvider.make;
      const detail = yield* provider.getIssue({ host: "github.com", repository: "o/r", number: 5 });
      assert.strictEqual(detail.body, "It crashes");
      assert.strictEqual(detail.comments[0]?.editedAt, "2026-01-03T00:00:00Z");
      assert.isTrue(detail.commentsTruncated);
      const refused = yield* provider
        .getIssue({ host: "github.com", repository: "o/r", number: 6 })
        .pipe(Effect.flip);
      assert.strictEqual(refused.reason, "not-found");
    }).pipe(Effect.provide(api));
  });

  it.effect("maps a refused credential and rejects a malformed repository", () => {
    const api = Layer.mock(GitHubRest.GitHubRest)({
      rest: (input) =>
        Effect.fail(
          new GitHubRequestPolicy.GitHubApiAuthenticationError({
            host: input.host,
            operation: input.operation,
          }),
        ),
    });
    return Effect.gen(function* () {
      const provider = yield* GitHubIssueProvider.make;
      const refused = yield* provider
        .listIssues({ host: "github.com", repository: "o/r", state: "open", page: 1, pageSize: 50 })
        .pipe(Effect.flip);
      assert.strictEqual(refused.reason, "unauthenticated");
      const malformed = yield* provider
        .getIssue({ host: "github.com", repository: "o/../r", number: 1 })
        .pipe(Effect.flip);
      assert.strictEqual(malformed.reason, "failed");
    }).pipe(Effect.provide(api));
  });
});
