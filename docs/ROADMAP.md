# Roadmap

Upstream: [pingdotgg/t3code](https://github.com/pingdotgg/t3code). This fork is AE Code,
[SelfRef/ae-code](https://github.com/SelfRef/ae-code) (`origin` = the fork, `upstream` = pingdotgg).

**Policy: no PRs.** Changes are not offered upstream (its `CONTRIBUTING.md` turns away unsolicited features; its
`AGENTS.md` says "a large number of our users run forks"). They live in this fork, kept easy to rebase on upstream.

Other forks of upstream, what each offers and where an idea here came from: [FORK_REFERENCES.md](./FORK_REFERENCES.md).

| #    | Change                                                                                                                                                                 | Status  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [25] | The Docker image updates in place from the fork's GitHub releases when `T3CODE_SELF_UPDATE=true` (Settings → About); one update channel, no Stable/Nightly picker      | done    |
| [24] | The changed-files card under an answer says when that run committed and pushed (read from its successful `git commit` / `git push` commands)                           | done    |
| [23] | Force push for a diverged branch (Git menu → "Force push..."), with a modal listing the commits it deletes and sends                                                   | done    |
| [22] | Git panel and Diff panel start on uncommitted changes; "Not pushed" is the old branch diff; Push shows how many commits it sends                                       | done    |
| [21] | Setting to turn off the "Push to default ref?" confirmation (Settings → Source control, on by default)                                                                 | done    |
| [20] | Install Claude Code and OpenCode from Settings → Providers with npm into `~/.local`, and update them there (not found in any fork)                                     | done    |
| [19] | Sidebar shows running subagents: a thread whose turn ended but whose subagents still work reads "N subagents" instead of a stalled "Waiting"                           | done    |
| [18] | Steer controls: "Stop it and send now" for a steer stuck behind a long command (Claude; take back not built; not found in any fork)                                    | done    |
| [17] | No product analytics: the server sends no usage events unless `T3CODE_TELEMETRY_ENABLED=true` (idea from E4 Code)                                                      | done    |
| [16] | MCP servers from Settings: one list of stdio and HTTP servers for Claude, OpenCode, Antigravity and Codex sessions (smaller version of E4 Code's patch)                | done    |
| [15] | Remove a built-in provider (Codex, Claude, ...) from Settings and the registry, with Restore                                                                           | done    |
| 14   | No git hooks: upstream's pre-commit hook, its `prepare` script and the `staged` config in `vite.config.ts` are removed (they need Node on the committing host)         | done    |
| [13] | Memory: saved preferences and decisions agents on any provider can recall and save, with a Settings page (modelled on GOAT's, cut down)                                | done    |
| [12] | Edit the latest message in place: the prompt becomes an inline editor, saving rewinds the thread and resends (idea from MT Code)                                       | planned |
| [11] | Inbox and board across projects, derived from thread state: what needs you, what runs, what awaits review (idea from T3 Kanban, not 1:1)                               | planned |
| [10] | Self-hosted Android push: the server notifies through ntfy instead of the hosted relay                                                                                 | planned |
| [9]  | Android app: AE Code package id, built and signed by the release workflow                                                                                              | done    |
| [8]  | Docker image of the release server on GHCR                                                                                                                             | done    |
| [7]  | Date-versioned releases (`vYYYY.MM.DD`): the Linux x64 server archive                                                                                                  | done    |
| [6]  | Daily sync: a workflow rebases the patch stack onto upstream and force-pushes `main`                                                                                   | done    |
| [5]  | Claude usage limits for a setup-token session: let `rate_limit_event` stream updates fill the bars when `get_usage` is unsupported                                     | done    |
| [4]  | Project and thread switchers in the chat breadcrumb (ported from a community branch, below)                                                                            | done    |
| 3    | Claude reply text streams while it is written (upstream's `ClaudeAdapterV2` drops `text_delta`, issue #17270; port of the closed PR #22165 onto the 2026-11-08 `main`) | done    |
| [2]  | GitHub Issues panel: list, read, comment, edit, label, close/reopen issues per project                                                                                 | planned |
| [1]  | Linux desktop as a Device-panel device (headless Mutter/GNOME Shell + capture + input)                                                                                 | planned |
| [0]  | Rebrand as AE Code: own app id and state dir, Aperte icon                                                                                                              | done    |

[0]: #identity-change-0
[1]: #linux-desktop-in-the-device-panel-change-1
[2]: #issues-panel-change-2
[4]: #breadcrumb-switchers-change-4
[5]: #claude-usage-limits-with-a-setup-token-change-5
[6]: #daily-sync-change-6
[7]: #releases-changes-7-and-9
[8]: #docker-image-change-8
[9]: #releases-changes-7-and-9
[10]: #self-hosted-android-push-change-10
[11]: #inbox-and-board-change-11
[12]: #edit-the-latest-message-in-place-change-12
[13]: #memory-change-13
[15]: #removing-a-built-in-provider-change-15
[16]: #mcp-servers-from-settings-change-16
[17]: #no-product-analytics-change-17
[18]: #steer-controls-change-18
[19]: #sidebar-subagent-status-change-19
[20]: #install-claude-code-and-opencode-from-settings-change-20
[21]: #default-branch-push-confirmation-change-21
[22]: #uncommitted-changes-first-change-22
[23]: #force-push-change-23
[24]: #commit-and-push-on-the-changed-files-card-change-24
[25]: #in-place-updates-of-the-docker-image-change-25

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
(2026-11-05, open) proposes the fix, and its author has it on the `feat/breadcrumb-switchers` branch of
`mollymillions-code/t3code` (2 commits, web only, no contract or server change; what it does is in
[FORK_REFERENCES.md](./FORK_REFERENCES.md#other-notable-forks)).

Done: the two commits are one commit on the fork's `main` (MIT, authorship kept; the second fixed the first, so they
were squashed). They merged cleanly. The diff is 5 files, +725/−71: three new files (`BreadcrumbSwitchers.tsx`,
`breadcrumbSwitcher.logic.ts` and its test) and edits to `ChatHeader.tsx` (~130 lines, the rebase risk) and its browser
test. Both test files pass. If upstream adopts the discussion, drop the commit.

## Claude usage limits with a setup-token (change 5)

Problem: a Claude session authenticated by `CLAUDE_CODE_OAUTH_TOKEN` (the long-lived token from `claude setup-token`) shows "Limits: Unavailable". The token has only the `user:inference` scope; the SDK's `get_usage` control request needs `user:profile`, so it answers `rate_limits_available: false` and `claudeUsageResponseToLimits` (`apps/server/src/provider/claudeUsageLimits.ts`) records `unavailable.reason = "unsupported"`. A login made with `claude auth login` has the scope and gets the bars. `claude auth status` shows which one wins (`oauth_token` means the env token shadows a stored login).

Why stream events don't rescue it: during a turn the CLI emits `rate_limit_event` frames built from the response's rate-limit headers, which any subscription token receives. `ClaudeAdapterV2` already maps them with `claudeRateLimitEventToUpdate` (needs a numeric `utilization`; five-hour and seven-day windows, and the overage bucket once named by a probe). But `applyUsageLimitsUpdate` (`packages/provider-core/src/server/usageLimits.ts`) returns `previous` unchanged while `previous.unavailable.reason === "unsupported"`, and a later probe result replaces the published value (`resolveUsageLimitsAfterProbe`), so the bars never appear.

Done: Claude's stream events fill the windows even when the probe says `unsupported`.

- **The spike.** A real turn with `CLAUDE_CODE_OAUTH_TOKEN` alone (an empty home, no stored login), Claude Code 2.1.316:
  the `rate_limit_event` has no top-level `utilization`. It carries `rate_limit_info.unifiedWindows` with `five_hour` and
  `seven_day`, each with `utilization` (0 to 1), `resetsAt` and `status`. The SDK typings we pin do not have the field,
  and `claudeRateLimitEventToUpdate` only read the top-level one, which the CLI adds at warning thresholds, so the plan
  as first written would have rendered nothing.
- `claudeRateLimitEventToUpdate` reads `unifiedWindows` structurally (new `readUnifiedWindows`); a top-level
  threshold window still wins for its own id. This also refreshes both bars on every event for a normal login.
- `makeManagedServerProvider` takes `streamFillsUnsupportedLimits`, set only by `ClaudeDriver`. With it,
  `applyUsageLimitsUpdate` fills an `unsupported` snapshot and drops its `unavailable` marker, and
  `resolveUsageLimitsAfterProbe` keeps windows the stream already filled when a later probe is `unsupported` (as it
  already does for `probeFailed`). Codex and the other providers keep the old rule: unsupported means stay empty. A
  test pins that.
- The client needed no change: the snapshot has windows and no `unavailable`, so the Limits row renders as for any login.

Expected behaviour: no bars until the first turn after a restart, then both windows, refreshed each turn. Only what the
events carry shows (no per-model buckets, no spend). Tested in `claudeUsageLimits.test.ts` and `usageLimits.test.ts`.
Checked in a dev server started with only the setup-token (an empty home, no stored login): after one Haiku turn,
Usage → Limits showed Claude's Session and Weekly bars.

Rebase cost: small edits in `claudeUsageLimits.ts`, `usageLimits.ts`, `managedProvider.ts` and `ClaudeDriver.ts`, and tests
beside them. Drop the flag if upstream starts using stream updates for `unsupported` providers.

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

In-place updates are off by default; see "In-place updates of the Docker image (change 25)".

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
  state). It is module-private today (`shouldPublishAgentAwarenessEvent`, `resolveAgentAwarenessRelayPublishSnapshot`
  in `AgentAwarenessRelay.ts`; `makeAgentAwarenessPublishWorker` is exported). Prior art: t3dpcode's self-hosted push
  exports those functions and imports them in its notifier, a few-line edit to an upstream file
  ([FORK_REFERENCES.md](./FORK_REFERENCES.md#t3dpcode-ochen1t3dpcode)); it also keeps a table of registered devices,
  which ntfy does not need. Settings in server settings (`packages/contracts`): ntfy URL, topic, which phases alert, and
  an access token kept in the secret store. A section in Settings → Notifications.
- Spike first: publish by hand with `curl` for a thread that fails, to check the link opens the thread on the phone
  and what the tap does when the app is not installed.
- `infra/relay/scripts/android-push-watch.ts` is the model for a notifier that needs no database: it follows one
  environment's shell stream and sends through a client.

Not decided: action buttons that approve from the notification (ntfy `http` actions would need a token with approval
scope on the phone; skip until there is a need). Rebase cost: new files, one settings schema addition and a layer
registration in `serverRuntimeStartup.ts`.

## Inbox and board (change 11)

Idea from T3 Kanban (a thread is a task with a hand-set status, a board and list across projects, an Inbox of the latest
result per task, and an MCP tool with which the agent updates its own task) and T3 Agents (a board across connected
environments); both in [FORK_REFERENCES.md](./FORK_REFERENCES.md#t3-kanban-what1ft3kanban). Not copied 1:1: a second,
hand-set status drifts from what the agent is doing, and upstream already tracks the state a board needs. Threads are sectioned by active, settled and snoozed, with pins,
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

Idea from MT Code ([FORK_REFERENCES.md](./FORK_REFERENCES.md#mt-code-munimtechnologiesmtcode)). Today **Edit from here** (`RevertUserMessageButton` in `TimelineUserMessageRow.tsx`, confirm dialog
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

## Steer controls (change 18)

Problem: while the agent runs a long foreground command (a `timeout 580 gh run watch` in the case that prompted this), a
follow-up sent as a **steer** shows only the "Steer" marker on the message. It cannot be taken back, and nothing makes
it take effect before the command ends.

What exists (`docs/user/composer.md`): Queue or Steer by setting, per message and by shortcut. A _queued_ message is a
dashed message at the end of the thread with **Send now**, edit and remove, and `thread.steerQueuedMessage` promotes the
oldest one. A message that is already a steer has none of that: `UserMessageIntentMarker` in
`TimelineUserMessageRow.tsx` is a label with a tooltip.

Findings, measured against the real Claude Code CLI (2.1.316, stream-json, Haiku, a foreground `timeout 90 tail -f
/dev/null` as the long command, a message with `priority: "now"` sent 8 s in):

- **The steer waits for the command.** It was delivered 81 s later, when the command ended (the turn's result then read
  `aborted_tools`). `priority: "now"` only preempts calls the SDK lets step aside (WebFetch and WebSearch,
  `detachedToolCall`), not a foreground shell, whatever `activeSteeringInterruptsTools: true` says.
- **A plain interrupt does not help.** The `interrupt` control request answered with the steer in `still_queued`, but the
  command kept running to its end. Stop in the thread has the same limit for a foreground command.
- **Stopping the shell task does.** A foreground shell is a task (`task_started`, `task_type: "local_bash"`,
  `is_backgrounded: false`). `stop_task` on it killed the command at once (`[killed]`), the result read `aborted_tools`,
  and the steer ran one second later. The adapter already handles that result as part of a steer (`steeredTurns`).
- **Withdraw works.** `cancel_async_message` with the uuid of a steer still queued behind the command answered
  `cancelled: true`, and the steer never ran.
- **There is a delivery signal.** A uuid-stamped message gets `command_lifecycle` frames: `queued` when sent, `started`
  when the CLI takes it (the adapter already reads these for turn prompts). Steers are not uuid-stamped today.

Built (web and desktop, Claude): **Stop it and send now**.

- A line above the composer, `Your message is waiting for <command> to finish`, with a **Stop it and send now** button.
  It shows while the newest steer (typed as a steer, or a queued message sent with **Send now**, which promotes it to a
  steer) has no answer yet and a command that began before it still runs. Derived on the client in
  `deriveThreadQueueWorkflowState` (`waitingSteer`, `packages/client-runtime`), so it needs no new projection field.
- RPC `orchestration.expediteSteer` (`threadId`), operate scope, run under the thread lock with a 15 s bound, through
  `ThreadManagementService.expediteSteer` to the optional adapter method `expediteSteer`, offered when the provider
  declares `turns.supportsSteerExpedite`. Errors: `not-running`, `unsupported`, `unavailable`, `expedite-failed`.
- Claude: `ClaudeAdapterV2` keeps the ids of foreground shell tasks (set on `task_started` with `is_backgrounded` exactly
  `false`, cleared on `task_notification` and at the turn's result) and `expediteSteer` calls `stopTask` on them. Nothing
  else is touched: background shells, the turn and subagents keep running. With no foreground command it fails instead
  of doing nothing. Tested in `ClaudeAdapterV2.test.ts`; the derivation in `threadWorkflows.test.ts`.
- Not a stop of the turn: only the command ends, the model reads its `[killed]` result and then the steer.
- `ChatView.tsx` mounts the queue control only while something is queued; it now also mounts it while a steer waits
  (found by the run below, the first version never rendered the line).

Checked in a running dev server (headless Chromium driving the web client, Claude Haiku 4.5 with the user's login):
a thread running `timeout 400 tail -f /dev/null`, a steer typed in the composer, the line appeared, **Stop it and
send now** delivered the steer in about a second and the turn ended with the reply. The same with a message queued
(`Ctrl+Enter`), sent with **Send now** (it becomes a steer, the line appears), then **Stop it and send now**.

Not built, in this order:

1. **Take back.** Stamp the steer with a uuid, call `cancel_async_message`, mark the message withdrawn and return its text
   to the composer. Needs a withdrawn state on the message, so a contract change that every client follows. The
   `command_lifecycle` `started` frame would also give a real "delivered" signal to replace the client-side guess.
2. **Other providers.** OpenCode 2.0.26 with a local Qwen model has the same stall: a steer sent while a foreground
   `timeout 200 tail -f /dev/null` ran got no reply for 60 s and the command was still running; it shows no line,
   because it does not declare `supportsSteerExpedite`. It needs its own way to stop that command (a tool-call abort
   or an interrupt and resend; `supportsSteeringByInterruptRestart` is true there). Codex and the ACP providers
   (Antigravity and others) are not measured. Each needs its own spike before it declares the flag.
3. **Mobile.** The data is shared (`queueWorkflowAtom`); the mobile queue is a sheet, so the line needs its own place in
   the thread view.
4. **Agents.** An MCP option on `t3_thread_send` for the same action.

Forks: checked on 2026-11-09 by searching the fork-own commit subjects of twelve forks for steer, queue, send now,
interrupt and follow-up; none has it. Related work only: t3dpcode keeps queued follow-ups on the server, KamiCode edits
and cancels queued messages (upstream has both now), K-code lets ACP agents steer live turns and cancel open prompts,
Type-Delta coordinates checkpoint mutations across steers ([FORK_REFERENCES.md](./FORK_REFERENCES.md)).

Rebase cost: one new RPC (contract, rpc, permission, authorization, instrumentation and `ws.ts` entries), one optional
capability flag, one optional adapter method, small edits in `ClaudeAdapterV2.ts`, `ThreadManagementService.ts`,
`threadWorkflows.ts` and `QueuedRunsControl.tsx`.

## Sidebar subagent status (change 19)

Subagent threads have no sidebar row, so a thread that started one and then ended its turn looked finished: the shell
runtime parks at `idle` while a subagent is in `pendingBackgroundTasks`, and the row showed a muted "Waiting" with a
timer counting from the run's end.

- `resolveSidebarThreadStatus` (web) and `resolveThreadListV2Status` (mobile) return `working` when a pending task has
  `kind: "subagent"`, below failed/limited so a failure still shows. `pendingSubagentTasks`
  (`packages/client-runtime/src/state/models.ts`) is the shared filter.
- The row label reads "1 subagent" or "N subagents" while the turn is not running (no timer: tasks carry no start time,
  and the run's end would lie). The status pill reads "Subagents". The web hover card lists each subagent's description.
- While the turn runs the shell's roster is empty, so the label counts the subagents' own live child threads instead
  (`runningSubagentCountsByThread` in `threadShell.ts`, nested ones counted on the nearest listed ancestor) and shows
  "N subagents" beside the timer. The shell keeps a child while it has a live run, so the count has no gaps.
- No contract or server change; the roster was already on the thread shell. Subagent rows under the parent were left out.
- Other background work (monitors, awaited commands, `background_task`) still reads "Waiting".

## MCP servers from Settings (change 16)

Goal: one list of MCP servers, added and removed in one place (Settings), applied to new sessions of Claude, OpenCode and
Antigravity, and of Codex if that costs little. The hard requirement is a remote MCP hub: an HTTP server behind a fixed
`Authorization: Bearer` header, such as an MCPHub group (`/mcp/<group>`, or `/mcp/$smart/<group>` under Smart Routing,
where the hub advertises only `search_tools` and `call_tool`). It must work the same on all of them. A catalog
("marketplace") comes later, so the data model must not stand in its way.

Problem: T3 gives every session one MCP server of its own (`t3-code`) and has no place to add others. Each provider's
own config (Claude's `.mcp.json` and user settings, Codex's `config.toml`, OpenCode's `opencode.json`) still works, but
per provider and per machine, and the providers do not share one.

### Findings in the source

How each adapter hands `t3-code` to its provider, and where an extra server would go:

| Provider                       | Today                                                                                                                                                                                                                                                                                                             | An extra server                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude (`ClaudeAdapterV2.ts`)  | `claudeMcpQueryOverrides` builds the SDK `mcpServers` record (`t3-code`: `type: "http"`, `url`, `headers`) and `allowedTools` gets `mcp__t3-code__*`; it is applied with `setMcpServers` once the query runs. Some queries also load the user, project and local settings (`settingSources`).                     | One more record entry: `{ type: "http", url, headers }` or stdio. Trusted servers add `mcp__<name>__*` to `allowedTools`. Easy.                                                                                                                                                                                 |
| Codex (`CodexAdapterV2.ts`)    | `codexThreadRuntimeParams` returns a per-thread `config` map for the app-server: `mcp_servers.t3-code` (`url`, `http_headers`, `tool_timeout_sec`) and a second direct-only entry. Its comment says servers from launch arguments survive, so Codex's own `config.toml` servers keep working.                     | One more `mcp_servers.<name>` key: `url` plus `http_headers`, or `command`, `args`, `env`. Easy; check the key names against the installed Codex version.                                                                                                                                                       |
| OpenCode (`provider-opencode`) | `prepareTurn` calls `client.mcp.add({ server, location: { directory }, config: Mcp.RemoteConfig { type: "remote", url, headers, oauth: false } })` each turn and `removeMcp` when the credential or directory changes. The schema also has `LocalConfig` (`command[]`, `environment`) and a `timeout` per server. | The same call per extra server, with a set of names to remove (`state.mcp` holds one today). `mcpRules` allows only `<t3 name>_*`, so trusted servers need a rule too. Against an external OpenCode 1.x server T3's own server is skipped; extra HTTP servers could still be added, stdio ones would run there. |
| Antigravity (ACP runtime)      | `acpMcpContext` builds `mcpServers` for `session/new`. `sessionMcpServers` (`AcpSessionRuntime.ts`) returns **one** list: the `acp`-typed one if the agent advertises `mcpCapabilities.acp`, else the `http` one if it advertises `http`, else the stdio list. The Antigravity flavor sets `mcpOverHttp: true`.   | Extras must be added to **all three** lists, or they vanish when the agent supports the ACP type. If the agent lacks HTTP, the stdio `acp-mcp-bridge` (`AcpMcpStdioBridge.ts`, endpoint and `Authorization` taken from the environment) can front any bearer-token HTTP server.                                 |

- The same seam covers every ACP-based provider (Grok, Kiro, Muse, fx, registry agents), which differ in HTTP support
  (`codex-acp` and `pi-acp` drop injected HTTP servers). Cursor and Pi inject through their own code
  (`provider-cursor`, `provider-pi/mcpInjection.ts`); they are "not supported yet".
- One place feeds every adapter: `McpProviderSessionConfig` (`packages/provider-core/src/server/mcpSession.ts`) is
  issued per thread by `ProviderSessionManager.prepareMcpSession` and read by each adapter's start code. Putting the
  resolved extras there means the setting and its secrets are read once, in the server, and each adapter only
  translates them. The credential is reused across workspace handoffs, so a changed list reaches new sessions, not
  running ones (the same rule as change 13's switches).
- Tool names differ per provider (`mcp__<name>__tool`, `<name>.tool`, `<name>_tool`), so a server name is limited to
  letters, digits, `_` and `-`, and `t3-code`, `t3-code-direct` and OpenCode's hashed T3 names are reserved.
- Approvals: under Smart Routing every call is `call_tool` with the real tool as an argument, so no client-side rule can
  separate reads from writes; the hub is the guard. A per-server **trusted** switch (allow all its tools without asking)
  is therefore needed, and each provider has its own way to express it (above).

Candidate: E4 Code's commit `feat(settings): manage MCP servers for Claude and Codex` (MIT; about 2,900 lines in 33
files, with OAuth), described in [FORK_REFERENCES.md](./FORK_REFERENCES.md#e4-code-stonith404e4code). It covers Claude
and Codex only and touches the files that conflict most on a rebase.

### Built (first cut: no OAuth, no catalog)

Guide: `docs/user/mcp-servers.md`.

- **Contract** (`packages/contracts/src/mcpServer.ts`, shape from E4's file, MIT): `name` (letters, digits, `_`, `-`;
  `t3-code` and `t3-code-*` are reserved, which also keeps OpenCode's per-thread T3 names apart), `enabled`,
  `transport` `http` (`url`, `headers`) or `stdio` (`command`, `args`, `env`), `providerInstanceIds` (none means every
  instance) and `trusted`. A `ResolvedMcpServer` type is the same with secrets as real values.
- **Storage:** `mcpServers` in `ServerSettings` and its patch (a small edit to `settings.ts`, which a self-created table
  would have avoided but which gets the settings read, patch and scope plumbing for free). Header and env values go to
  the secret store through `settingsSecrets.ts` (slot `mcp-server-<name>-header|env-<key>`); `settings.json` keeps only
  the redaction marker, which was checked. A patch of `mcpServers` needs the providers-manage scope, since a stdio
  server is a command run on the host (`requiredScopesForServerSettingsPatch`).
- **Seam:** `extraServers` on `McpProviderSessionConfig`, resolved in `ProviderSessionManager.prepareMcpSession`
  (`apps/server/src/mcpServers/resolveMcpServers.ts`: enabled, for this provider instance, empty secret values dropped)
  and refreshed whenever a session prepares, including when the thread's MCP credential is reused. A change reaches
  sessions that start afterwards.
- **Adapters**, each turning the list into its own shape:
  - Claude: more entries in the SDK `mcpServers` record (`http` with headers, or `stdio`); a trusted server adds
    `mcp__<name>__*` to `allowedTools`, except in a read-only sandbox.
  - Codex: more `mcp_servers.<name>` keys in the thread's `config` (`url` and `http_headers`, or `command`, `args`,
    `env`). Codex has no trusted rule yet.
  - OpenCode (`v2/adapter.ts`): `client.mcp.add` per server each turn (`RemoteConfig` or `LocalConfig`), a set of added
    names to remove when a config or directory changes, and an `allow` permission rule for trusted ones. An external
    OpenCode server gets the remote ones only, since a stdio server would run on its host.
  - ACP, so Antigravity and the other ACP providers (`acpMcpContext`): a stdio server goes in every list the session
    can choose from; a remote one as `http` where the flavor takes it (`mcpOverHttp`), else through the stdio bridge
    (`acp-mcp-bridge`), which carries only one `Authorization` header, so a remote server with other headers is left
    out there. No trusted rule: those providers use T3's approvals.
- **Settings → MCP servers** (web and desktop, one environment at a time): the list with an enable switch, edit and remove;
  an inline editor for remote or command servers (URL, headers or command, arguments, environment, provider chips,
  trusted); **Paste JSON** for the `mcpServers` shape most tools share (`mcpServersSettings.logic.ts`).
- Tests: the resolver, the Claude and Codex builders, and the page's logic (draft round trips, validation, import).

Checked in a dev server (headless Chromium, a scratch project): a fake bearer-protected MCP server added through the
page; a Claude Haiku turn and an OpenCode turn on a local Qwen model both called its tool and returned its answer, and
the server saw the bearer on every request. The same with the real MCPHub `code` group at `/mcp/$smart/code` (a `$` in
the URL, key from the page): both providers called `search_tools` and returned the first tool it found.

Not checked: Codex and Antigravity are not installed here, so they are covered by the unit tests only (Codex's key
names are the ones the existing `t3-code` entries already use). Antigravity's `mcpCapabilities.http` was not read; its
flavor sets `mcpOverHttp`, as for `t3-code`, and the bridge is the fallback.

Not built, in order: a **Test** button that connects once and shows the tool count or the error; auto-allow for
trusted servers in Codex and the ACP providers; a **catalog** (the official MCP Registry as templates for the add form);
**OAuth** for remote servers (E4's `McpServers.ts` and `McpServersHttp.ts`); importing what Claude, Codex and OpenCode
already have in their own config; a header or env value that names a server environment variable instead of holding the
key; and a mobile screen.

Rebase cost: new files (contract, resolver, page, route) and small edits to `settings.ts`, `settingsSecrets.ts`,
`mcpSession.ts`, `ProviderSessionManager.ts`, the Claude, Codex, OpenCode and ACP adapters, the settings sidebar and
search, `_chat.settings.tsx` and the generated route tree.

## No product analytics (change 17)

Upstream's server sends product usage events to its PostHog ingest unless `T3CODE_TELEMETRY_ENABLED=false`
(`apps/server/src/telemetry/AnalyticsService.ts`). The fork flips the default: no events unless
`T3CODE_TELEMETRY_ENABLED=true`. Same patch as E4 Code's ([FORK_REFERENCES.md](./FORK_REFERENCES.md#e4-code-stonith404e4code)), redone on this checkout.

- The flag's default is `false` in both places `AnalyticsService` reads it (the config and the late desktop shell-consent
  lookup). The test that checked "disabled" now omits the flag, so it checks the default. Other tests set it explicitly.
- Copy: the welcome page notice, the About → Legal description, `docs/user/telemetry.md` and `docs/user/faq.md` say the
  fork sends no usage data.
- Left as upstream, on purpose: relay tracing (`isRelayTracingEnabled` in `packages/shared/src/otelEnvironment.ts` counts
  an unset flag as enabled) and the mobile app's own crash reports and traces. The fork's builds carry no relay, trace
  or crash-report endpoint configuration (`ae-release.yml` sets none; the mobile `observe` endpoint is `.invalid`
  without `T3CODE_RELAY_URL`), so nothing is sent. Changing them would touch the desktop IPC, the server config and their
  tests for no gain; revisit if the fork ever builds with relay configuration.
- Not covered: **Publish agent activity** (needs a T3 Connect link, which the fork does not have) and the provider CLIs'
  own telemetry, which T3 does not control.

## Memory (change 13)

Saved preferences, decisions and facts that every agent on every provider can recall and add to, with a Settings page
to see and edit them. Modelled on GOAT's memory ([FORK_REFERENCES.md](./FORK_REFERENCES.md#goat-goat-sigoat)), cut down to what one
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
- **Getting it back** is Add provider, which still offers every driver: it creates a new instance (the default id
  stays reserved for the removed one).
- No data migration: the field is new and optional. An older server ignores it and shows the provider disabled.
- **Rebase cost.** `providerInstance.ts` (one field), `ProviderInstanceRegistryHydration.ts` (three lines),
  `ProviderSettingsPanel.tsx` (row filter, one callback, the delete button on default rows).

## Install Claude Code and OpenCode from Settings (change 20)

Upstream installs only Antigravity's runtime and the managed Codex runtime from the app; Claude and OpenCode can be
updated there but not installed. An image that ships without agent CLIs has nowhere to get them but a shell.

- **Install** in the provider's Settings card (`ManagedCliInstallSection`) runs
  `npm install -g --prefix <home>/.local --allow-scripts=<package> <package>` for `@anthropic-ai/claude-code` and
  `@opencode/cli` (npm 11 skips the install script without the flag). `NpmPackageInstallation` keeps one operation per
  driver, a 10-minute limit, a cancel that kills npm, and a redacted tail of npm's output for the failure message. The
  state reuses `ProviderInstallState` with a new `installing` phase, since npm reports no bytes. Installs run one at a
  time (both packages write to the same prefix). npm links the launcher before the package's postinstall runs, so a
  cancelled, timed-out or failed install removes the launcher and package it created (never one that was already
  there), and a launcher that exists but fails to start keeps `canInstall` true so the row stays.
- `providerInstallation.ts` accepts the two drivers: an empty binary path or the default command counts as managed, a
  custom path is refused. A finished install refreshes every instance of the driver. Remove is not offered.
- The snapshot reports `setup.canInstall` while the CLI is missing, the instance is enabled and uses the default
  command. Not on Windows, where npm lays a prefix out differently.
- `<home>/.local/bin` is appended to the PATH the Claude and OpenCode processes get, after the existing entries, so a CLI
  on PATH still wins and a fresh install works without a restart. When a managed copy is the one found, the provider
  message says where.
- Updates needed no change: the maintenance resolvers already read an npm prefix from the real path of the launcher, so
  **Update now** runs `npm install -g --prefix <home>/.local <package>@latest`. Tests now cover this layout.
- Mobile has no provider install flow at all (not for Codex or Antigravity either), so it is untouched. No MCP tool
  triggers an install; the capability is a service method if one is wanted.
- No data migration. Nothing is renamed; the only new state is npm's own files under `~/.local`.
- **Rebase cost.** New files: `NpmPackageInstallation.ts`, `managedNpmInstall.ts` (provider-core), the web section.
  Small edits: `providerInstallation.ts`, `server.ts` (one layer), `providerSetup.ts` (one literal), `ClaudeHome.ts` and
  `ClaudeDriver.ts`, the OpenCode `driver.ts` and `adapter.ts`, `ProviderSettingsPanel.tsx` (one branch).

## Default branch push confirmation (change 21)

Pushing, or creating a pull request, from the default branch opens a "Push to default ref?" dialog (`GitActionsControl`).
Upstream has no way to turn it off.

- The client setting `confirmPushToDefaultBranch` (default `true`) is a switch in Settings → Source control, beside the
  commit and pull request writing options. Off skips the dialog and runs the action on the current branch, as if
  "Push to <branch>" had been chosen.
- Device-local like other client settings. The dialog's own buttons are unchanged.
- No data migration: a new key with a decoding default.

## Uncommitted changes first (change 22)

Upstream (#15005) made the Diff panel open on all branch changes against the base and made the thread details
"Changes" row count the same, so work that was committed but not pushed looked like pending edits.

- The thread details row reads "Uncommitted" and counts the working tree only (local checkout or worktree); a clean
  tree reads "No changes" instead of +0 -0.
- The Diff panel selector lists "Uncommitted" first and opens on it; the old "Changes" scope is "Not pushed" (same diff
  and base picker). The server still sends `branchChanges`; the client no longer reads it.
- The Push quick action reads "Push N commits" (ahead of the upstream, or of the base ref when there is no upstream).
  A click marks the action running at once, since the server's first progress event arrives late.
- Existing per-thread selections in `t3code:diff-panel-state:v1` are kept; only the default and the reset on open changed.

## Force push (change 23)

When a branch has commits the upstream lacks and the upstream has commits the branch lacks (after an amend, rebase or
autosquash), Push and Pull both refuse and the quick action reads "Sync ref". Upstream's only advice is "Rebase/merge
first", which is wrong after a deliberate rewrite.

- The Git menu gets "Force push..." while the branch is both ahead and behind its upstream. Choosing it asks the server
  for a preview (`vcs.forcePushPreview`) and opens a modal with the commits only the remote has (deleted by the push),
  the commits only this checkout has (published), and the remote commit the push will replace. Both lists are capped
  at 50; the counts are the real totals.
- Confirming sends `vcs.forcePush` with that remote commit. The server runs `git push --force-with-lease=<ref>:<sha>`
  against it, so a push by anyone since the preview makes the remote refuse and nothing is overwritten.
- Only a branch tracking the remote branch of the same name qualifies: a feature branch whose upstream is another
  branch (a base) is refused rather than force-pushed to it. A branch that is only ahead or only behind keeps Push and
  Pull, and the server rechecks that too.
- Needs the source control write scope, like Pull. Web only: mobile's Git actions don't list it.
- No data migration: two new RPCs and one new action operation.

## Commit and push on the changed-files card (change 24)

The card under an answer listed the files a run changed but not whether the agent then committed or pushed them, so the
only way to know was to scroll through the commands.

- The card header adds "Committed", "N commits", "Committed, pushed" or "Pushed" when the run's work log holds a
  successful `git commit` or `git push` command (lifecycle completed, no failure marker, not `--dry-run`). It reads the
  commands, not the repository: a commit made some other way, or whose command output was never loaded, is not shown,
  and neither is the push state the repository is in now.
- Web only; mobile has no changed-files card. No data migration, no contract change.

## In-place updates of the Docker image (change 25)

Upstream's remote update path needs an npm package, a boot service or the desktop app, and its Settings → About offered
a Stable/Nightly "Update track". The fork publishes one stream of GitHub releases (`vYYYY.MM.DD`) and its server runs
in a container, so none of that applied.

- **Switch:** `T3CODE_SELF_UPDATE=true` on the image. The image's entrypoint (`packaging/docker/entrypoint.sh`) then
  sets `T3CODE_UPDATE_SUPERVISED=1` for the server, which is what makes the server report the existing `respawn`
  self-update capability. Without the switch the entrypoint `exec`s the server as before and Settings → About says
  that updates are off. A plain server never gets the capability, because nothing would start it again.
- **Check:** `server.npmRelease` (the RPC keeps upstream's name) answers `latest` from
  `api.github.com/repos/SelfRef/ae-code/releases/latest`, tag `v2026.11.09` read as version `2026.1109.0`. Anonymous
  GitHub requests are limited to 60 an hour per address; the answer is cached for a minute.
- **Install:** About → Install calls the existing `server.updateServer`. The server only accepts the newest release,
  downloads `ae-code-linux-x64.tar.gz`, checks it against the digest GitHub lists for the asset, unpacks it into
  `<home>/updates/<version>`, runs its `ae-code --version`, points `<home>/updates/current` at it and stops itself as a
  SIGTERM would. The entrypoint then starts the server again from `current`. It keeps the image's own binary unless the
  download is newer (an updated image over an old volume) and starts again only when `current` changed or on SIGHUP
  (`docker kill -s HUP <container>` restarts the server without recreating the container), so `docker stop` and
  crashes behave as before. The client's existing respawn handling waits for the server to come back on the new version.
- **Limits:** the downloaded release has to run on the image's base (Ubuntu 24.04), and the state volume must allow
  executables. Rolling back is `rm -r <home>/updates` and a restart. The desktop app's own updater is unchanged: no
  desktop installers are released (see Identity).
- **Update track removed:** the Stable/Nightly picker, its dialog and the hosted-app channel switch are gone, because the
  fork has one channel. The track-switch planning in the sidebar's "update everything" code is left in place to keep
  rebases small.

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
