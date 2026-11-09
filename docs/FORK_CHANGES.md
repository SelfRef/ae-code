# Fork changes

Upstream: [pingdotgg/t3code](https://github.com/pingdotgg/t3code). This fork is AE Code,
[SelfRef/ae-code](https://github.com/SelfRef/ae-code) (`origin` = the fork, `upstream` = pingdotgg).

**Policy: no PRs.** Changes are not offered upstream (its `CONTRIBUTING.md` turns away unsolicited features; its
`AGENTS.md` says "a large number of our users run forks"). They live in this fork, kept easy to rebase on upstream.

| #   | Change                                                                                                                                                                 | Status  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 16  | Manage MCP servers from Settings: extra stdio and HTTP servers added to every provider session (port of E4 Code's patch or a smaller own version)                      | planned |
| 15  | Remove a built-in provider (Codex, Claude, ...) from Settings and the registry, with Restore                                                                           | done    |
| 14  | No git hooks: upstream's pre-commit hook, its `prepare` script and the `staged` config in `vite.config.ts` are removed (they need Node on the committing host)         | done    |
| 13  | Memory: saved preferences and decisions agents on any provider can recall and save, with a Settings page (modelled on GOAT's, cut down)                                | done    |
| 12  | Edit the latest message in place: the prompt becomes an inline editor, saving rewinds the thread and resends (idea from MT Code)                                       | planned |
| 11  | Inbox and board across projects, derived from thread state: what needs you, what runs, what awaits review (idea from T3 Kanban, not 1:1)                               | planned |
| 10  | Self-hosted Android push: the server notifies through ntfy instead of the hosted relay                                                                                 | planned |
| 9   | Android app: AE Code package id, built and signed by the release workflow                                                                                              | done    |
| 8   | Docker image of the release server on GHCR                                                                                                                             | done    |
| 7   | Date-versioned releases (`vYYYY.MM.DD`): the Linux x64 server archive                                                                                                  | done    |
| 6   | Daily sync: a workflow rebases the patch stack onto upstream and force-pushes `main`                                                                                   | done    |
| 5   | Claude usage limits for a setup-token session: let `rate_limit_event` stream updates fill the bars when `get_usage` is unsupported                                     | planned |
| 4   | Project and thread switchers in the chat breadcrumb (ported from a community branch, below)                                                                            | planned |
| 3   | Claude reply text streams while it is written (upstream's `ClaudeAdapterV2` drops `text_delta`, issue #17270; port of the closed PR #22165 onto the 2026-11-08 `main`) | done    |
| 2   | GitHub Issues panel: list, read, comment, edit, label, close/reopen issues per project                                                                                 | planned |
| 1   | Linux desktop as a Device-panel device (headless Mutter/GNOME Shell + capture + input)                                                                                 | planned |
| 0   | Rebrand as AE Code: own app id and state dir, Aperte icon                                                                                                              | done    |

`done` means it is a commit on `main`; the commit is found by subject (`git log --grep`), not by hash, because every
rebase onto upstream changes the hashes. The history rules and the sync procedure are in the last section.

## Identity (change 0)

The fork can run beside upstream's T3 Code on one machine, so it has its own names:

| What                               | Upstream                                   | Here                                             |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| Display name                       | T3 Code (Beta)                             | AE Code                                          |
| State dir (server, CLI, installer) | `~/.t3`                                    | `~/.ae` (also on SSH and WSL hosts)              |
| App id, Linux desktop entry        | `com.t3tools.t3code`, `com.t3tools.T3Code` | `dev.aperte.AECode`, `dev.aperte.AECode.desktop` |
| Android app id, name               | `com.t3tools.t3code`, T3 Code              | `dev.aperte.aecode`, AE Code                     |
| Electron profile, Linux executable | `t3code-v2`, `t3code`                      | `ae-code`                                        |
| Release and update source          | `pingdotgg/t3code`                         | `SelfRef/ae-code`                                |
| Mark                               | T3                                         | The Aperte glyph on its Nord-palette tile        |

The app id follows the Aperte apps (`dev.aperte.Todav`, `dev.aperte.Notav`). The text name is ASCII ("AE Code"): a non-ASCII name would end up in the Electron User-Agent and in installer and file names.

Not renamed, to keep rebases small: `T3CODE_*` env vars, `@t3tools/*` packages, the `t3` command, the `t3code` URL scheme, `T3Wordmark`, file names such as `com.t3tools.t3code.metainfo.xml` (only its contents changed), the model manifest URL (still read from upstream), and the user docs under `docs/user`, which still say `~/.t3`. The worktree dev state dir stays `.t3`.

Icons: `assets/prod` is the Aperte icon on a dark Nord tile; `nightly` and `dev` use the same glyph on warmer and bluer variants of that palette. All rasters (`assets/*/*.png`, `.ico`, `apps/web/public`) are rendered straight from SVG, because Icon Composer (macOS only) is not available here, so they approximate its glass effect and `icons:check` will not pass until they are re-exported there. The Icon Composer projects only had their `text.svg` glyph swapped (and the prod fill), so a later export puts the glyph on the old dev and nightly backgrounds.

Caveats:

- Only the Linux x64 server archive is released (`ae-release.yml`, see "Releases (changes 7 and 9)"); no desktop installer (AppImage, deb, dmg, exe) is built or tested, so the desktop app's in-app updater finds nothing. The install scripts and `t3 update` read `SelfRef/ae-code` releases for upstream's `t3-<version>-<platform>` archives, which the fork does not publish; the release's `ae-code-linux-x64.tar.gz` is unpacked by hand. A server image does not need them: build the CLI archive from source (see the stack's Dockerfile, which follows `release-desktop.yml`'s "Build CLI archive" steps).
- Data written by upstream's T3 Code is not read: see the next section.

### Moving to the AperteDev org

The app id is already `dev.aperte.*`. The repository is still referenced as `SelfRef/ae-code` in the update, install and star-prompt code, the Linux metainfo and these docs. After transferring the repository, `git grep -l 'SelfRef/ae-code'` lists every place to change (and the `AGENTS.md` line above).

## Data migration

Anything that moves or renames persisted data gets a row here, with how to carry the data over. Run migrations with the server stopped.

| Moved from → to                                                | What lives there                                                                                                                         | Migration                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.t3` → `~/.ae` (server, CLI, installer, service)            | The T3 home: `userdata` (database, settings, keybindings, logs), `secrets`, `service.env`, `runtime`, `worktrees`, `projects`, `scratch` | Stop both servers, then `cp -a ~/.t3 ~/.ae`. Or keep the old directory by setting `T3CODE_HOME=~/.t3`; nothing moves. Worktrees and project folders created under the old home keep their old paths (the database stores them), so keep `~/.t3` until they are archived. Do not start the fork against upstream's live directory while upstream's server runs. |
| `~/.t3/{runtime,ssh-launch,device}` → `~/.ae/...` on SSH hosts | The server runtime T3 installs on a remote machine, and its launch state                                                                 | None. The next connection bootstraps the new location; delete the old `~/.t3` on the host when no upstream T3 uses it.                                                                                                                                                                                                                                         |
| `~/.t3/wsl-runtime` → `~/.ae/wsl-runtime` in WSL               | The server runtime for the desktop app's WSL environment                                                                                 | None, it is re-installed. Remove the old directory by hand.                                                                                                                                                                                                                                                                                                    |
| Electron profile `t3code-v2` → `ae-code`                       | Desktop app profile: window state, safeStorage keys, desktop-local storage                                                               | Not migrated, except that Windows copies its credential keys from the legacy profile names. Sign in again, or copy the profile folder while the app is closed.                                                                                                                                                                                                 |
| Android app `com.t3tools.t3code` → `dev.aperte.aecode`         | The app's local data: the paired servers, its settings                                                                                   | None. It installs beside upstream's app as a new app with its own data; pair the servers again. Its APKs are signed with the fork's own key (see Releases).                                                                                                                                                                                                    |

The `~/.t3` `T3CODE_HOME` default is also what a pre-existing upstream `t3 service` and a Docker volume home point at, so check both before switching a running install.

## Linux desktop in the Device panel (change 1)

T3's Device panel is the right surface: live stream, touch/click input, screenshots, accessibility tree and
the `device_*` agent tools, per thread. It is closed over `ios | android`, so a third platform needs both a
**host** (something that produces frames and takes input) and a few **enum/allowlist touch points**.

### Findings in the source (`ade473018d`)

- `packages/contracts/src/device.ts`: `DevicePlatform = Schema.Literals(["ios","android"])`. About 130 non-test files
  mention `"android"`, but most are display/label branches; the load-bearing ones are the contract, the
  platform availability record and `DeviceActions`.
- `apps/server/src/device/DeviceHost.ts`: the `DeviceHost` interface (local, SSH, EAS and Simlock hosts implement it);
  `DeviceHostReady.upstream?` lets a host name its own HTTP upstream instead of the bundled hub.
- `DeviceHubProxy.ts`: the browser never talks to the hub directly; the proxy allowlists exact paths
  (`/vendor/serve-sim/*`, `/vendor/serve-emu/*`). A new backend needs its own allowlist entries.
- Client stream (`packages/client-runtime/src/device/stream.ts`): WebRTC/avcc, MJPEG fallback
  `…/stream.mjpeg`, input over a WebSocket. **If the desktop backend speaks the `serve-emu` protocol the client
  needs almost no change.**
- Agent tools: `agent-device` (MIT, Callstack) already has a **Linux platform** (AT-SPI tree through
  `atspi-dump.py`; `xdotool` on X11, `ydotool` on Wayland; `scrot`/`import`/`gnome-screenshot` or `grim`;
  a pluggable `input` provider). `AgentDeviceShim.ts` is where T3 starts it.

### Design

1. **Backend: `linux-desktop-host`, a small standalone service** (own package/process, not in T3's tree beyond a
   host adapter). Runs `gnome-shell --headless --wayland --virtual-monitor WxH` (or plain `mutter --headless` for
   apps that don't need the Shell) in its own D-Bus session, with:
   - **Capture:** `org.gnome.Mutter.ScreenCast` (record the virtual monitor) → PipeWire → GStreamer (`pipewiresrc !
     jpegenc` for MJPEG, `x264enc` for avcc later) served as `serve-emu`-compatible endpoints.
   - **Input:** `org.gnome.Mutter.RemoteDesktop` (pointer absolute/relative, buttons, scroll, keycodes). No
     `/dev/uinput` and no root.
   - **Tree/screenshot for the agent:** AT-SPI (`agent-device --platform linux`) plus the ScreenCast frame.
   - GOA, Shell extensions, portals and the real session run as in a normal GNOME login: that is the point.
2. **T3 side (the fork's whole diff):**
   - add `"linux"` to `DevicePlatform` and the matching availability/summary fields;
   - a `DesktopDeviceHost` implementing `DeviceHost`, returning `upstream` = the backend (config: URL or the
     env var `T3_DESKTOP_HOST`; off when unset, so the fork behaves like upstream by default);
   - `DeviceHubProxy.ts` allowlist entries for the backend's paths;
   - client: platform label/icon, a desktop-shaped frame (no phone bezel, pointer instead of touch, keyboard
     capture), tool wiring in `AgentDeviceShim.ts` for `--platform linux`.
3. **Windows later:** same host interface, backend = a VM (QEMU/KVM + RDP/VNC) behind the same protocol; the T3
   change from step 2 does not repeat.

Unverified (spike before building): ScreenCast/RemoteDesktop without a logged-in GNOME session (permissions,
`--headless` flags of the installed gnome-shell), PipeWire in a rootless container, frame rate of software-rendered
MJPEG at 1440×900.

Spike order: the backend alone (headless GNOME Shell + ScreenCast + RemoteDesktop, a `curl`able MJPEG stream and a
scripted click, no T3 change), then the contract/host/proxy/client changes against it.

## Issues panel (change 2)

Goal: per project with a GitHub remote, track, read, answer, update and close its issues inside T3, the way the
pull-request views already work, without going to github.com.

### Findings in the source (`f26623febe`)

- **Pull requests are the template, issues don't exist.** The PR feature is a full vertical slice: contracts
  (`packages/contracts/src/pullRequest.ts`, `WS_METHODS.pullRequests*` in `rpc.ts`, write scopes in
  `clientRpcPermissions.ts`), a forge-neutral `PullRequestProviderApi`
  (`packages/source-control-core/src/server/PullRequestProvider.ts`) exposed by each driver as
  `SourceControlDriverInstance.pullRequests` (`driver.ts`), the GitHub implementation
  (`packages/source-control-github`: GraphQL `.graphql` files + generated `.graphql.ts`, `GitHubRest.ts`,
  `GitHubRequestPolicy`/`GitHubQuota`), one server service (`apps/server/src/pullRequest/PullRequestService.ts`)
  behind one-line `ws.ts` handlers, MCP tools (`apps/server/src/mcp/toolkits/pullRequests/`), web
  (`apps/web/src/components/pullRequest/`, right-panel kinds `pull-request`/`pull-requests`, page
  `/pull-requests`) and mobile (`apps/mobile/src/features/pull-requests/`).
- What exists for issues: `#12` autolinks to `/issues/12`, `#` completion that already searches issues
  (`RepositoryReferences` query, `PullRequestReferenceCandidate.kind = "issue"`), link previews of issue URLs
  (`GitHubSourceControlProvider.resolveLink`). No list/detail/comment RPC, schema, provider method, panel or MCP
  tool. A PR detail on an issue URL shows "It may be an issue rather than a…".
- **Reusable as is:** GitHub credentials (`GitHubCredentials.ts`: settings/app/env/`gh`; a token needs Issues
  read/write), the GraphQL client and quota policy, project → forge resolution
  (`PullRequestService.resolveRemoteHosts` → `recognizeRemote` → `SourceControlProviderRegistry`), the
  refresh-epoch pattern (`SubscriptionRef` + streamed `subscribeRefreshes`, clients refetch on change), and the
  mutations GitHub shares between issues and PRs: `AddComment`, `UpdateIssueComment`, `AddReaction`, labels via the
  REST issues endpoint. On the web side the markdown renderer (`PullRequestMarkdown`), composer/textarea with
  `#`/`@` completion, label picker and title editor.
- Upstream has no issue work in flight (no branch or PR besides `codex/issue-NNNN-*` bug fixes).

### Design

A **separate `issues` slice next to pull requests**, not a generalisation of the PR code into "work items":
renaming or widening `PullRequest*` would touch hundreds of upstream lines and conflict on every rebase.
Everything new goes in new files; existing files only get registrations.

1. **Contract** (`packages/contracts/src/issue.ts`, new): `IssueRef` (projectId + number), `IssueListInput`
   (projectId, state open/closed/all, query, labels, assignee, author, cursor), `IssueListEntry`, `IssueDetail`
   (body, author, labels, assignees, milestone, state + `stateReason`, timestamps, viewer permissions),
   `IssueActivity` (comments + the few timeline events worth showing: closed/reopened, labelled, assigned,
   cross-referenced PR), inputs for `comment`, `update` (title/body), `updateComment`, `setLabels`,
   `setAssignees`, `runAction` (`close-completed | close-not-planned | reopen`) and `create`. Reuses
   `PullRequestActor`/`PullRequestLabel`/`PullRequestComment` types where they fit instead of copying them.
   `WS_METHODS.issues*` + `Rpc.make`s appended next to the PR block in `rpc.ts`; mutations under
   `AuthSourceControlWriteScope` in `clientRpcPermissions.ts`.
2. **Provider:** `IssueProviderApi` in `source-control-core` (new file), plus one optional field
   `issues?: IssueProviderApi | null` on `SourceControlDriverInstance` (optional, so the GitLab/Forgejo/Bitbucket/
   Azure drivers compile untouched and simply have no Issues panel). GitHub implementation in new files:
   `issues.graphql` (list via `search(type: ISSUE, query: "repo:o/r is:issue …")` so filters are GitHub's own
   search syntax, detail + timeline, `closeIssue(stateReason)`, `reopenIssue`, `createIssue`, `updateIssue`,
   `addAssignees`/`removeAssignees`), `GitHubIssueApi.ts`, `gitHubIssueJson.ts`; one wiring line in the GitHub
   `driver.ts`. Other forges later through the same interface.
3. **Server:** `apps/server/src/issue/IssueService.ts` (new) resolves the project's forge the same way as
   `PullRequestService` (extract or call its `requireProject`; a small read cache like `PullRequestReadCache`, and a
   refresh epoch bumped after each mutation and on manual refresh). No webhooks/polling, since a server behind a
   private network can't receive GitHub's calls: refresh on open, on focus and by hand. `ws.ts` gets one-line
   handlers; the service layer is added where `PullRequestService` is provided.
4. **Web:** right-panel kinds `issues` (list for the current project: state tabs, search box, label/assignee
   filters, "New issue") and `issue` (detail: title/body editable, labels, assignees, timeline, composer, actions
   menu Close as completed / Close as not planned / Reopen, "Open on GitHub"). Touch points are the ones listed
   for a new panel kind: `rightPanelStore.ts`, `RightPanelSurfaceContent.tsx`, `RightPanelTabs.tsx`,
   `useRightPanelActions.ts`, `closedViewStore.ts`, `reopenClosedView.ts`, `CommandPalette.tsx` ("Issues",
   "New issue"). Components in `apps/web/src/components/issue/` (new), reusing the PR markdown, composer and
   label picker; client state in `packages/client-runtime/src/state/issues.ts` (new). A `#123` autolink that is
   an issue opens the `issue` panel instead of the PR detail's "may be an issue" message (one branch in
   `PullRequestDetailPanel` or the link handler).
5. **Agents (MCP):** what a user can do, an agent reaches through MCP, so add `list_issues`, `read_issue`,
   `comment_on_issue`, `update_issue` (state/labels/assignees) and `create_issue` in
   `apps/server/src/mcp/toolkits/issues/` (new), registered in `McpHttpServer.ts`. Agents can also use `gh`, so
   this is lower priority than the panel.
6. **Start a thread from an issue:** a "Work on this" action in the issue panel that opens a new thread (optionally
   in a worktree) with the issue's title, body and comments as the first message, and links them so the issue
   shows its threads. Second phase: it needs a thread ↔ issue link record (like `ThreadPullRequestService`) and
   therefore a migration, the biggest rebase risk in this change.
7. **Mobile: not planned.** The store builds of the mobile app come from upstream and would never carry the fork's
   screens unless the fork built and sideloaded its own. The web panel works in a phone browser. The contract
   stays client-agnostic, so mobile screens can be added later.

### Phases

| Phase | Scope                                                                                                    | Commits (one per concern)                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Read-only: list + detail + activity, web panel, command palette                                          | `feat(contracts): issue schemas and rpc`, `feat(source-control): issue provider api`, `feat(github): read issues`, `feat(server): issue service`, `feat(web): issues panel` |
| B     | Write: comment, edit title/body/comment, labels, assignees, close (completed/not planned)/reopen, create | `feat(github): issue mutations`, `feat(server): issue mutations`, `feat(web): edit and close issues`                                                                        |
| C     | MCP tools for agents                                                                                     | `feat(server): issue mcp tools`                                                                                                                                             |
| D     | Thread from issue + link                                                                                 | `feat(server): link threads to issues`, `feat(web): start a thread from an issue`                                                                                           |

Verification per phase: tests next to the new files (GitHub JSON → contract mapping, service project resolution,
permission guard rows extended in the existing RPC permission test), `vp run check:changed`, then one pass in a
real client: `vp run dev` in a worktree with a seeded `.t3`, against a throwaway issue in a test repo.

Rebase cost: about 15 existing files touched, each with an appended block (rpc.ts, clientRpcPermissions.ts,
driver.ts ×2, ws.ts, server layer, McpHttpServer.ts, seven web panel files); `rpc.ts` and `ws.ts` are the hot
ones, so keep the blocks contiguous and directly after the PR entries. Phase D adds a migration (numbered after
upstream's newest; renumber on rebase if upstream adds one).

Open questions: are creating issues (phase B) and the thread-from-issue flow (phase D) wanted; list in the right
panel only, or also a full `/issues` page like `/pull-requests`?

## Breadcrumb switchers (change 4)

Problem: T3 has no project switcher. A project has no page of its own (`/projects/<key>` redirects to its settings);
you reach it only through one of its threads. Today's ways in: Ctrl+K and type the project name (opens its newest
thread or a new draft, `CommandPalette.tsx` `openProjectFromSearch`), the sidebar, or the project name in a new
draft's heading "What should we build in _project_?" (a real picker that looks like plain text). The top-bar
breadcrumb's project name looks like a switcher but starts a new thread in that project (`ChatHeader.tsx`
`onNewThreadInProject`).

Upstream: issue #27445 (the breadcrumb looks like a switcher) closed as not planned on 2026-11-01, as a duplicate of
discussion #22991 (picker discoverability); discussion #31438 "Project and thread switchers in the chat breadcrumb"
(2026-11-05, open) proposes the fix, and its author has it on `mollymillions-code/t3code` branch
`feat/breadcrumb-switchers` (2 commits, web only, no contract or server change): both crumbs become searchable
dropdowns; the project crumb lists projects in sidebar order and opens the picked one's newest thread (or a new
one), with "New thread in <project>" as its first item so today's click stays one step away; the thread crumb lists
the project's threads (pinned first, older ones paged in while open), "New thread" first, "Thread actions" last;
right-click and double-click on the title keep working.

Plan: cherry-pick those two commits onto the fork's `main` (MIT, authorship kept). Checked 2026-11-09: they merge
cleanly onto upstream `main` (`b7d33af938`). The diff is 5 files, +725/−71: three new files
(`BreadcrumbSwitchers.tsx`, `breadcrumbSwitcher.logic.ts` and its test) and edits to `ChatHeader.tsx` (~130 lines,
the rebase risk) and its browser test. Verify with `vp test run` on the two test files, `vp run check:changed`, and
one pass in a dev client. If upstream adopts the discussion, drop the commits.

## Claude usage limits with a setup-token (change 5)

Problem: a Claude session authenticated by `CLAUDE_CODE_OAUTH_TOKEN` (the long-lived token from `claude setup-token`) shows "Limits: Unavailable". The token has only the `user:inference` scope; the SDK's `get_usage` control request needs `user:profile`, so it answers `rate_limits_available: false` and `claudeUsageResponseToLimits` (`apps/server/src/provider/claudeUsageLimits.ts`) records `unavailable.reason = "unsupported"`. A login made with `claude auth login` has the scope and gets the bars. `claude auth status` shows which one wins (`oauth_token` means the env token shadows a stored login).

Why stream events don't rescue it: during a turn the CLI emits `rate_limit_event` frames built from the response's rate-limit headers, which any subscription token receives. `ClaudeAdapterV2` already maps them with `claudeRateLimitEventToUpdate` (needs a numeric `utilization`; five-hour and seven-day windows, and the overage bucket once named by a probe). But `applyUsageLimitsUpdate` (`packages/provider-core/src/server/usageLimits.ts`) returns `previous` unchanged while `previous.unavailable.reason === "unsupported"`, and a later probe result replaces the published value (`resolveUsageLimitsAfterProbe`), so the bars never appear.

Plan: let Claude's stream events fill the windows even when the probe says `unsupported`.

1. `applyUsageLimitsUpdate` drops the `unsupported` early return for updates that carry windows. This helper is shared with Codex and the other providers, so keep the change to that one condition and check their tests (`codexUsageLimits.test.ts`, `usageLimits` tests) still pass; if another provider relies on "unsupported means stay empty", gate it behind an optional flag on the update that only the Claude adapter sets.
2. `resolveUsageLimitsAfterProbe`: when the probe is `unsupported` and the published value already has stream windows, keep the windows instead of replacing them with the empty probe result.
3. Client: check that the Limits row (web `apps/web`, mobile `ComposerUsageLimits.tsx`, `UsageLimitsSection.tsx`) renders windows even when `unavailable` is set. If it tests `unavailable` first, show the windows when there are any.

Expected behaviour: no bars until the first turn after a restart, then the windows named in the events, refreshed each turn. Only what the events carry shows (no per-model buckets, no spend).

Unverified (spike first): whether this CLI version puts `utilization` in `rate_limit_event` frames for a setup-token session; check with a real turn and a log of the raw `rate_limit_info`. If it doesn't, there is nothing to render and the only way to get bars is a full login instead of the token.

Rebase cost: three small edits to existing files (two in `usageLimits.ts`, one client condition) and tests beside them. Drop the change if upstream stops discarding stream updates for `unsupported` providers.

## Daily sync (change 6)

`.github/workflows/ae-sync.yml` runs every day at 03:17 UTC (and on demand): it rebases `main` onto upstream's `main`
and force-pushes it. A conflict fails the run and pushes nothing; no issue is opened, the failed run is the signal.
Resolve it locally with the procedure in the next section and push.

- **Only `ae-*.yml` workflows run on this fork.** Upstream's use runners (`blacksmith-*`) and secrets a fork does not
  have, so their jobs would queue forever. The sync run disables every active workflow that is not `ae-*`, so a workflow
  upstream adds is switched off on the next run. A rebase never touches that setting.
- **Secret `SYNC_TOKEN`:** a fine-grained personal access token for this repository with Contents and Workflows
  read/write. The default `GITHUB_TOKEN` cannot push changes to `.github/workflows`, which upstream edits often.
- **Force-push safety:** `--force-with-lease` pinned to the commit the run started from, so a push made meanwhile wins
  and the run fails.
- GitHub pauses scheduled workflows after 60 days without repository activity; a daily push keeps them alive, and the run
  can be started by hand from the Actions tab.

## Releases (changes 7 and 9)

`.github/workflows/ae-release.yml` is started by the daily sync (or by hand, with `force` to release an unchanged
`main`). It publishes a GitHub release when `main` is not the commit of the latest release. Upstream's `release.yml` is
not used: it needs `blacksmith-*` runners, relay and Clerk configuration, signing secrets and the Play APK. The `cli` job
repeats the CLI archive steps of upstream's `release-desktop.yml` (build, resource monitor, `build-cli-archive.ts`,
smoke test) on a GitHub-hosted runner, without Electron; that workflow itself is not called, so the sync leaves it
disabled.

- **Versions:** tag and title `vYYYY.MM.DD`, then `vYYYY.MM.DD.1`, `.2` for later releases the same day. The apps need a
  semver, so the packages (and the updater feed) carry `YYYY.MMDD.N`: `2026.1109.0` for `v2026.11.09`. It increases
  with every release, which is all the updater needs.
- **Release notes:** the upstream commit the release sits on, then what changed since the previous release: a compare
  link between the two upstream commits (`pingdotgg/t3code`), and the fork patches that release did not have. A patch
  counts as new by its subject, because every rebase rewrites the hashes, so a fixup that keeps the subject is not
  listed. The first release lists every patch. The full list is the table above.
- **Contents:** `ae-code-linux-x64.tar.gz`, the Linux x64 server: the single executable `ae-code` with the web client,
  the resource monitor and its own libatomic (`ae-code serve`). Upstream's archive is `t3-<version>-linux-x64.tar.gz`
  holding `t3`; the workflow renames both after the smoke test, because the server's update and install code looks for
  upstream's names and the fork's source is left alone. The file name has no version so that
  `releases/latest/download/ae-code-linux-x64.tar.gz` always points at the newest one. The executable still calls itself
  `t3` in its help text.
- **Android (change 9):** the `android` job runs after the release exists and attaches `ae-code-<tag>.apk` to it, so an
  Android failure never withholds the rest. `expo prebuild` and `gradlew assembleRelease` with `APP_VARIANT=production`,
  arm64 and x86_64 (phones and emulators; each ABI compiles the native modules again, so a cold build took about 40
  minutes with both), Gradle's dependency cache kept between runs, Expo's cloud updates off, then the APK is re-signed
  with the fork's key
  (Expo's template signs release builds with the public debug key). The version name is `YYYY.MMDD.N`, the version code
  `YYMMDDNN`. The production Android package is `dev.aperte.aecode` and the name AE Code (`apps/mobile/app.config.ts`),
  so it installs beside upstream's app; the `t3code` URL scheme is kept. Not rebranded yet: the Android launcher icon,
  splash and notification glyph are still the T3 mark, and thread links on `app.t3.codes` open a chooser because that
  domain only lists upstream's package.
- **Secrets for Android:** `ANDROID_KEYSTORE` (base64 of a PKCS12 keystore; its first key is used, whatever the alias)
  and `ANDROID_KEYSTORE_PASSWORD` (store and key share it in PKCS12). Create the key once and keep it: an update must be
  signed with the same key as the installed app.
  `keytool -genkeypair -keystore ae-code.jks -alias ae-code -keyalg RSA -keysize 4096 -validity 36500`.
- **Not built:** the desktop app (AppImage, `.deb`, macOS, Windows), iOS, arm64 server; no relay or Clerk configuration
  (T3 Connect sign-in is absent, pairing with a server works as before), no npm launcher, no tests or checks. A broken
  `main` shows as a failed build.
- **First run:** started by hand from the Actions tab. The Android build took about 40 minutes with a cold cache; that
  is what to expect when Gradle's cache is evicted (GitHub drops caches unused for 7 days).

## Docker image (change 8)

The `image` job of `ae-release.yml` wraps the release's Linux x64 server archive in `packaging/docker/Dockerfile` and
pushes `ghcr.io/selfref/ae-code:<YYYY.MM.DD[.N]>` and `:latest`. Nothing is built from source in the image: it is Ubuntu
24.04 (the archive is built on that glibc), `git`, `ssh` and the archive in `/opt/ae-code`, a non-root user (uid 1000),
state in `/home/ae/.ae` (a volume), port 3773, started with `ae-code serve`. Agent CLIs are not included; derive an
image to add the ones you use.

A package GitHub creates starts private: after the first push, make `ae-code` public in the package settings (Package
settings, Change visibility). Checked locally by building it around an upstream archive and starting the server.

## Self-hosted Android push (change 10)

Problem: this fork gets no push notifications. Upstream's path is the server's `AgentAwarenessRelay`
(`apps/server/src/relay/AgentAwarenessRelay.ts`), which projects each thread with `projectThreadAwarenessV2`
(`packages/shared/src/agentAwareness.ts`; phases `starting`, `running`, `waiting_for_approval`, `waiting_for_input`,
`completed`, `failed`, `stale`) and publishes signed activity to the hosted relay. The relay (`infra/relay`: Cloudflare
Workers and queues, Postgres, Clerk sign-in) sends FCM data messages that the app's native module
(`t3-agent-notifications`) renders as cards and Live Updates. It needs T3 Connect sign-in and a relay deployment, which
the fork does not have (`docs/operations/android-notifications.md`; "Background delivery requires T3 Connect" in
`docs/user/mobile-notifications.md`). The fork's package id also differs from the one the hosted relay and Firebase
project know.

Reusing ntfy: yes, as the transport. Two tiers, the first needs no app change:

1. **Server notifier (do this first).** A server service publishes to a self-hosted ntfy topic: title is the thread
   title, message the awareness headline, `Priority` high for `waiting_for_approval`, `waiting_for_input` and `failed`,
   `Click` the thread's link (the `t3code` URL scheme the fork keeps, or the server's web URL). The phone uses the ntfy
   app; no Firebase, no app rebuild, and it works for any client. It loses the in-app cards, Live Updates and
   grouping.
2. **UnifiedPush (only if tier 1 is not enough).** ntfy is a UnifiedPush distributor. The app would register for an
   endpoint, the server would POST the card payload to it, and the existing native renderer would show it. This needs
   native-module work and a registration endpoint on the server.

Plan for tier 1:

- New `apps/server/src/notifications/` service fed by the same projection as the relay. Reuse the relay's transition
  selection (alert on entering approval, input or failure; one grouped alert for several; no repeat for an unchanged
  state) if it can be imported; today it sits with the relay code, so check whether it can move to `packages/shared`
  or must be copied. Settings in server settings (`packages/contracts`): ntfy URL, topic, which phases alert, and an
  access token kept in the secret store. A section in Settings → Notifications.
- Spike first: publish by hand with `curl` for a thread that fails, to check the link opens the thread on the phone
  and what the tap does when the app is not installed.
- `infra/relay/scripts/android-push-watch.ts` is the model for a notifier that needs no database: it follows one
  environment's shell stream and sends through a client.

Not decided: action buttons that approve from the notification (ntfy `http` actions would need a token with approval
scope on the phone; skip until there is a need). Rebase cost: new files, one settings schema addition and a layer
registration in `serverRuntimeStartup.ts`.

## Inbox and board (change 11)

Idea from `what1f/t3kanban`: a thread is a task with a business status (Todo, In Progress, In Review, Blocked, Done), a
board and list across projects, an email-style Inbox of the latest result per task, and an MCP tool with which the
agent reads and updates its own task. Not copied 1:1: a second, hand-set status drifts from what the agent is doing,
and upstream already tracks the state a board needs. Threads are sectioned by active, settled and snoozed, with pins,
auto-settle and wake rules (`docs/user/thread-sidebar.md`), and every thread has an awareness phase.

Phases, each useful alone:

1. **Inbox.** A page across projects and environments of threads that need you: waiting for approval or input, failed,
   or finished and not seen. Approvals and questions are answered in place. Needs a per-thread "seen" marker; check
   first whether upstream keeps one. Logic goes in `packages/client-runtime` so web and mobile share it.
2. **Board view.** Columns derived from state, not stored: Needs you, Running, Review (finished, not settled, has a
   diff or pull request), Parked (snoozed), Done (settled). Dragging a card is the existing action (snooze, settle,
   wake), so it cannot disagree with the thread.
3. **Manual status and agent tool (only if 1 and 2 fall short).** A status field on the thread and an MCP tool through
   which the agent sets it with a one-line note. This changes the contract, so every surface follows.

Check the surfaces list in `AGENTS.md` for each phase: web and desktop first, a read-only Inbox on mobile, and the MCP
tool for agents. Every way in needs the way out and the way to see it (mark unread, un-settle). Rebase cost: new
components and a new route; the sidebar and thread-shell projections are shared with upstream, so keep edits there to
a minimum.

## Edit the latest message in place (change 12)

Idea from MT Code. Today **Edit from here** (`RevertUserMessageButton` in `TimelineUserMessageRow.tsx`, confirm dialog
`RevertConfirmHost` in `ChatOverlayHosts.tsx`) rewinds the thread to before the message through `onRevertToTurnCount`
and returns the prompt and its attachments to the composer, where you edit and send again. Documented in
`docs/user/composer.md`.

Plan: for the latest user message only, an inline editor replaces the message in the timeline (text prefilled,
attachments kept). Save rewinds the thread to before the message, as the existing action does, and sends the edited
text; Cancel changes nothing. The files choice stays: the confirm shows **Revert and keep changes** (default) or
**Revert files too**, and the action is offered only when the provider supports rewind, like today's. If the rewind
succeeds and the send fails, fall back to today's behavior and put the text in the composer, so no prompt is lost.

Spike first: how `onRevertToTurnCount` and a send are sequenced, and whether one command can do both, to avoid a
window in which the thread is rewound but nothing is sent. Web and desktop; mobile follows if it has the rewind
action. Rebase cost: a new editor component and its logic file, plus a small edit in `TimelineUserMessageRow.tsx`.

## MCP servers from Settings (change 16)

Problem: T3 gives every session one MCP server of its own (`t3-code`; Codex also gets the direct-only `t3-code-direct`,
`CodexAdapterV2.ts`; Claude's tools are `mcp__t3-code__*`, `ClaudeAdapterV2.ts`) and has no place to add others. Servers can be added in each provider's own config (Claude's
`.mcp.json` and user settings, Codex's `config.toml`) if T3's sessions load it (see the spike), per provider and per
machine. The wish is one list, edited in Settings, applied to every session.

Candidate: E4 Code (`stonith404/e4code`, MIT), commit `feat(settings): manage MCP servers for Claude and Codex`. A
single commit of about 2,900 lines in about 35 files:

- `packages/contracts/src/mcpServer.ts` (96 lines): the `mcpServers` setting, stdio or Streamable HTTP. Env, header and
  client-secret values go to the secret store (`settingsSecrets.ts`); a patch needs the providers-manage scope, since a
  stdio server is a host command.
- `apps/server/src/mcpServers/McpServers.ts` (647) and `McpServersHttp.ts` (153): storage, merging across environments,
  and OAuth for HTTP servers (metadata discovery, PKCE, refresh, a proxy at `/mcp-servers/<name>` that adds the token).
- Adapters: about 35 lines each in `ClaudeAdapterV2.ts` and `CodexAdapterV2.ts` add the servers beside `t3-code`; `t3-code`
  and `t3-code-direct` are reserved names.
- Web: a Settings page (`McpServersSettings.tsx`, 938 lines, plus a logic file and tests), a route, a sidebar entry and
  search terms; RPC and permission entries in `rpc.ts`, `ws.ts`, `clientRpcPermissions.ts`. No mobile screen.

Claude and Codex only. It touches the files that conflict most on a rebase (both adapters, `ws.ts`, `rpc.ts`,
`settings.ts`).

Plan: build a smaller version on the same shape, taking E4's contract and its settings UI logic and leaving OAuth out of
the first cut:

1. Contract and storage as above (stdio and HTTP, secrets in the secret store, providers-manage scope), stored like change
   13's tables or in `ServerSettings`; prefer a self-created table if the settings schema would need edits.
2. One seam that injects the enabled servers next to `t3-code` in the Claude and Codex adapters. Check the ACP adapters
   too: `AcpMcpStdioBridge.ts` already hands servers to ACP agents, so one list could also cover ACP, OpenCode and Cursor;
   decide per adapter, "not supported" is allowed.
3. Settings → MCP servers (web and desktop), per-server enable switch and per-provider-instance selection. Servers for
   which a fixed header token is enough work without OAuth, including a gateway such as an MCP hub exposed over HTTP.
4. OAuth for HTTP servers as a second phase, ported from E4's `McpServers.ts` and `McpServersHttp.ts`, once the list
   exists.

Spike first: confirm whether Claude and Codex sessions started by T3 already load the user's own MCP config (then the
gap is only the shared list and the UI), and read E4's adapter hunks and secret handling before copying them. New
servers apply to new sessions, like change 13's switches. Agents: an MCP tool that lists the configured servers is
optional; the tools of the servers themselves reach the agent directly.

## Memory (change 13)

Saved preferences, decisions and facts that every agent on every provider can recall and add to, with a Settings page
to see and edit them. Modelled on GOAT's memory (a T3 Code fork with its own memory feature), cut down to what one
person needs. User guide: `docs/user/memory.md`.

- **Storage.** A `memories` table in the server's database (`id`, `scope` `user|project`, `project_id`, `text`,
  `source` `user|agent`, `source_thread_id`, timestamps), capped at 2000 rows of 2000 characters. `MemoryService` creates
  it with `CREATE TABLE IF NOT EXISTS` when the server starts, **not** through a numbered migration: upstream keeps adding
  migrations, and a fork migration would collide with the next one it adds. It is a new table, not a rename, so there is
  no migration step; delete the table to forget everything.
- **Recall is term ranking, not FTS or vectors.** `memoryRanking.ts` scores terms by rarity, then recency and scope, over
  at most 2000 rows read in one query. GOAT uses SQLite FTS5 with a tokenizer; at this size a full scan costs less than
  keeping an index consistent, and the function is the one place to swap if the corpus ever outgrows it.
- **Agents.** Three MCP tools in `mcp/toolkits/memory`: `t3_memory_recall`, `t3_memory_remember`, `t3_memory_forget`.
  They act as the calling thread (a live thread caller is required, and a read-only client may recall only). `project`
  scope means the caller's project. A short `<memory>` briefing in `runtimeInstructions.ts` rides with the pull-request
  linking text, so every adapter that sends one carries it: Claude, Codex, ACP, Cursor, Muse, OpenCode and Antigravity.
  Pi receives only the orchestration text and does not get it. The briefing says memory is reference data, never
  instructions.
- **Settings → Memory** (web and desktop, one environment at a time): list, search, scope filter, add, edit, forget,
  and the _Agent memory_ switch. Claude's own controls (the native-memory switch and the import) sit in the Claude
  provider card, in `ClaudeMemorySettings.tsx`, a "Memory" section shown for every `claudeAgent` instance and bound to
  the same environment-wide settings; a few lines in `ProviderInstanceCard.tsx` mount it. Five RPCs (`memory.list`, `memory.save`, `memory.delete`, `memory.setSettings`,
  `memory.importScan`); the three writes need the settings-write scope.
- **Switches** (`memory_settings`, one row in the same self-created tables, not `ServerSettings`, so upstream's settings
  schema is untouched). _Agent memory_ (default on): off removes the briefing from new sessions and makes the three
  tools refuse (`disabled`); saved memories stay, and the page still lists, edits and forgets them. _Turn off Claude's
  built-in memory_ (default on, effective only while memory is on): new Claude sessions get
  `autoMemoryEnabled: false` in their flag settings (`makeClaudeQueryOptions`), so Claude Code writes no memory files of
  its own. Only Claude has such a switch so far; other providers' own memory is untouched. Both apply to new
  sessions, not running ones. `packages/provider-core/src/server/memoryPolicy.ts` holds the current values as a
  process-wide variable that `MemoryService` publishes at start and on every change, because eight adapters build their
  instructions synchronously and threading a setting through each would touch all of them. Its default (nothing
  published) leaves a provider's own memory alone, which keeps the recorded Claude replay fixtures valid. The tools stay
  in the tool list while memory is off (registration is static), so the tool-list part of the context budget stays.
- **Claude starts with the memories, like its native index.** `ClaudeAdapterV2` appends a `<saved_memory>` digest to the
  session's system prompt: the newest user-scope memories, then the thread's project's, in 3000 characters, with a
  pointer to `t3_memory_recall` for the rest (`memoryDigest.ts`; one line per memory, `<` escaped so a memory cannot
  close the block). It reads a cache `MemoryService` refreshes on every write, through `memoryDigest()` in
  `memoryPolicy.ts`, so the adapter stays synchronous. Only Claude gets it: its system prompt is sent once per session,
  while Cursor, ACP and Muse repeat their instructions on every turn, where a digest would cost tokens each time.
  `t3_memory_recall` and `t3_memory_remember` also carry `anthropic/alwaysLoad`, as `request_secret` does, so Claude
  Code does not defer them behind ToolSearch.
- **Import from Claude** (Settings → Providers → Claude → Memory). `memory.importScan` reads `<folder>/<project>/memory/*.md` (default
  `~/.claude/projects` of the server's user; `MEMORY.md`, files over 64 KiB and everything else are skipped) and returns
  the entries; the dialog saves the selected ones through `memory.save`, so there is no second write path. It needs the
  `filesystem:read` scope. `user` and `feedback` files import as All projects, `project` and `reference` ones need a
  project, which the dialog pre-selects when a project's path, with every character outside A-Z, a-z, 0-9 turned into a
  dash, equals the folder's name; over 2000 characters are listed but not importable. Claude Code's folder holds the
  session transcripts too, so mount or copy only the `memory` folders into the container (see the stack's docs), never
  the whole `projects` folder.
- **Not built, from GOAT:** automatic summaries of finished threads, thread-scoped memory, importing Codex memories,
  sharing between devices (hub), conflict resolution, storage quotas, a digest for providers other than Claude, and a
  mobile page. The tools and the page are the seam for each.
- **Context budget.** The briefing and three tool definitions raise `agentContextBudget.json` (about 540 bytes of
  instructions per adapter that carries them, 1 KB of tool list). `agent-context-budget.yml` only gates pull requests,
  which this fork does not open, so nothing asks for the `agent-context-increase` label.
- **Evals not run.** `evals/mcp-tool-use` covers tool text and was not run (it needs paid model keys); add the memory
  toolkit to it and run it before changing the tool descriptions or the briefing.
- **Rebase cost.** New files: `packages/contracts/src/memory.ts`, `apps/server/src/memory/*`,
  `apps/server/src/mcp/toolkits/memory/*`, `MemorySettings.tsx` and its logic file, the route. Touch points of a few lines:
  `rpc.ts` and `clientRpcPermissions.ts` (three methods), `RpcAuthorization.ts`, `RpcInstrumentation.ts`, `ws.ts`,
  `server.ts` (one layer), `McpHttpServer.ts`, `t3McpToolPresentation.ts` with `t3ToolSummary.ts`, the Claude read-only
  allowlist, `runtimeInstructions.ts` with the Antigravity append, client-runtime `state/server.ts`, the settings
  navigation and search (`settingsSearch.ts`, `SettingsSidebarNav.tsx`, `_chat.settings.tsx`) and the generated route tree.

## Removing a built-in provider (change 15)

Upstream lists Codex and Claude in Settings → Providers whether or not their CLI is installed, and offers no way to
drop one: a built-in provider has only its on/off switch. A deployment that ships without one (an image with no Codex
CLI) is left with a dead row and a dead entry in the model pickers.

- **Remove** on a built-in provider's row saves its default instance as `{ enabled: false, hidden: true }`
  (`ProviderInstanceConfig.hidden`, optional). Its other settings are kept.
- The server leaves a `hidden` instance out of the registry (`deriveProviderInstanceConfigMap`), so it is not probed
  and not offered. Settings does not list it; threads that used it get the usual unavailable message.
- **Restore** is a button under the provider list, one per removed provider: it clears `hidden` and turns the instance on.
- No data migration: the field is new and optional. An older server ignores it and shows the provider disabled.
- **Rebase cost.** `providerInstance.ts` (one field), `ProviderInstanceRegistryHydration.ts` (three lines),
  `ProviderSettingsPanel.tsx` (row filter, two callbacks, a footer button).

## Keeping the fork up to date with upstream

`main` is a linear stack of patch commits on top of upstream's `main`: no merge commits, no feature branches. Staying
current means rebasing that stack onto the newest upstream `main`, never merging upstream into it.

**History rules**

- **One commit per concern** (contract enum, host, proxy allowlist, client, tools), so a conflict names the concern.
  Conventional Commits, one line.
- **A fix or follow-up goes into the commit it fixes** (`git commit --fixup=<commit>`, then
  `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <base>`), not into a new `fix:` commit. A stack that grows
  follow-ups gets longer to rebase and conflicts once per follow-up.
- **A patch's docs travel with it.** The change's section in this file (the `#` row, status, design notes) is edited in
  the commit that lands the change, never in a later `docs:` commit. Exception: a plan for a change that has not
  landed may be its own `docs:` commit; the commit that lands the change rewrites that section in place (status
  `done`, plan text trimmed to what the code does not show).
- **No fork commit hashes in docs.** Rebases change them; name a commit by its subject. (Upstream's hashes are stable,
  as in the "Findings in the source" notes.)
- Rewriting commits that are already pushed means a force-push (`git push --force-with-lease origin main`). Agents
  force-push after a verified rebase onto upstream, rewrite unpushed commits freely, and ask before rewriting other
  pushed ones. A regular push is the owner's.

**Sync procedure** (done daily by `ae-sync.yml`, see "Daily sync (change 6)"; by hand after a conflict)

1. `git fetch upstream`, then `git log --oneline HEAD..upstream/main` to see what is coming.
2. `git rebase upstream/main`. `git config rerere.enabled true` is set, so a conflict is resolved once and replayed on
   every later rebase. Resolve in the commit it appears in (`git rebase --continue`), not in a trailing fix commit.
3. Verify what the stack touches: `vp run check:changed` and the tests next to the patches, plus a dev-client pass for
   anything visible. A patch that upstream now covers is dropped from the stack and its row here is removed.
4. Force-push `origin main` with `--force-with-lease` pinned to the `origin/main` the rebase started from.

**Keeping conflicts small**

- **Additive over edited:** new code in new files with tests next to them. Edits to existing files stay at the touch
  points described in each change, a few lines each: no reformatting, no renames, no drive-by fixes.
- **Upstream identifiers stay** (env vars, package and file names); only values change (see the Identity section).
- **Off by default:** a feature nothing enables fails soft when a rebase drops a piece of it.
- **Upstream stays an option:** if the maintainers ever ask for it, the additive layout makes a branch a clean PR;
  until then nothing is offered.
