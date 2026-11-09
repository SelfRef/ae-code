# Fork changes

Upstream: [pingdotgg/t3code](https://github.com/pingdotgg/t3code). This fork is AE Code,
[SelfRef/ae-code](https://github.com/SelfRef/ae-code) (`origin` = the fork, `upstream` = pingdotgg).

**Policy: no PRs.** Changes are not offered upstream (its `CONTRIBUTING.md` turns away unsolicited features; its
`AGENTS.md` says "a large number of our users run forks"). They live in this fork, kept easy to rebase on upstream.

| #   | Change                                                                                                                                                                 | Where                                          | Status       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------ |
| 4   | Project and thread switchers in the chat breadcrumb                                                                                                                    | `main`, ported from a community branch (below) | planned      |
| 3   | Claude reply text streams while it is written (upstream's `ClaudeAdapterV2` drops `text_delta`, issue #17270; port of the closed PR #22165 onto the 2026-11-08 `main`) | `main` (`7ace0751ef`), one commit, tests pass  | done locally |
| 2   | GitHub Issues panel: list, read, comment, edit, label, close/reopen issues per project                                                                                 | branch `issues` (not started)                  | planned      |
| 1   | Linux desktop as a Device-panel device (headless Mutter/GNOME Shell + capture + input)                                                                                 | branch `desktop` (not started)                 | planned      |
| 0   | Rebrand as AE Code: own app id and state dir, Aperte icon                                                                                                              | `main`, a few commits (below)                  | done locally |

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

- The desktop installers (AppImage, deb, dmg, exe) are not built or tested. The release workflow only runs in upstream's repository, so `SelfRef/ae-code` has no releases yet; the install scripts and the in-app updater point at releases that do not exist until the fork publishes some. A server image does not need them: build the CLI archive from source (see the stack's Dockerfile, which follows `release-desktop.yml`'s "Build CLI archive" steps).
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

## Keeping the fork easy to rebase

- **Branch model:** the fork's `main` mirrors upstream; the work lives in feature branches (`desktop`, `issues`),
  rebased onto upstream `main` or a release tag, never merged. `git config rerere.enabled true`.
- **Additive over edited:** new code in new files (`apps/server/src/device/DesktopDeviceHost.ts`, the backend
  package, tests next to them). Edits to existing files stay at the touch points above, a few lines each, no
  reformatting, no renames, no drive-by fixes. Target diff: under ~15 changed existing lines plus new files.
- **One commit per concern** (contract enum, host, proxy allowlist, client, tools), so a conflict names the
  concern; Conventional Commits, one line.
- **Off by default:** nothing changes unless the desktop host is configured, so a missed rebase fails soft.
- **Track upstream:** rebase on the newest release, run the device tests (`apps/server/src/device/*.test.ts`) and the
  type check; a conflict is resolved once, in the fork.
- **Upstream stays an option:** if the maintainers ever ask for it, the additive layout makes a branch a clean PR;
  until then nothing is offered.
