# Roadmap

Upstream: [pingdotgg/t3code](https://github.com/pingdotgg/t3code). This fork is AE Code,
[SelfRef/ae-code](https://github.com/SelfRef/ae-code) (`origin` = the fork, `upstream` = pingdotgg).

**Policy: no PRs.** Changes are not offered upstream (its `CONTRIBUTING.md` turns away unsolicited features; its
`AGENTS.md` says "a large number of our users run forks"). They live in this fork, kept easy to rebase on upstream.

Other forks of upstream, what each offers and where an idea here came from: [FORK_REFERENCES.md](./FORK_REFERENCES.md).

| #    | Change                                                                                                                                                                 | Status  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 43   | Browser control modes: View only, Take control, and Share control, where you and the agent both act and the agent is not interrupted (web and Android)                 | done    |
| 42   | Current branch action: a project setting (Push by default) that picks whether the Git button also creates a pull request                                               | done    |
| 41   | Floating preview: window-style buttons in its top-right corner, shown while the pointer is over it, instead of a dot that opens a pill                                 | done    |
| [40] | Other ways to run the Android emulator in the Device panel: investigate Cuttlefish and scrcpy; a Google Play image and foldable support are required                   | planned |
| [39] | File operations in the Files panel: create files and folders, rename, move, copy and delete from a row's or the empty area's menu, on the web and in the Android app   | done    |
| [38] | Branches: every branch and worktree of a project with what to push, pull and merge, on the web (`/branches`) and in the Android app                                    | done    |
| [37] | Forgejo and Gitea use the `gt` CLI (Gitea 28+) instead of `tea`; `fj` stays preferred                                                                                  | done    |
| [36] | GitHub Releases: read-only list and detail per project on the web (`/releases`, right panel) and in the Android app                                                    | done    |
| [35] | Android catch-up: tinted Input, Done and draft threads; merge, force push and worktree switching in Git                                                                | done    |
| [34] | A "Thread actions" section in the thread details card: Settle thread, and the thread's context menu under an arrow                                                     | done    |
| [33] | Saved environments follow you: a browser signed in to a server shows the environments saved on any other browser signed in to it (kept on that server)                 | done    |
| [32] | Merge a thread's branch into the default branch (with or without pushing) and push the default branch, from a "Default branch" section of the thread details card      | done    |
| [31] | Move a started thread into a new worktree from the workspace control or the thread menu (the control used to lock after the first message)                             | done    |
| [30] | Synced drafts: unsent text, attachments, contexts and new-thread settings follow you across web, desktop and Android (on the server)                                   | planned |
| [29] | Appearance defaults: Dev artwork, 100 ms panel animations, composer context on, a version in the sidebar header; Nightly artwork removed                               | done    |
| [28] | Worktree defaults for parallel feature work: semantic branch names, no start from the remote, cleanup of merged, deleted, unchanged and settled (3 days) worktrees     | done    |
| [27] | Skills manager: every provider's skills in one list, then a shared library with per-provider switches                                                                  | done    |
| [25] | The Docker image and a plain `ae-code serve` update in place from GitHub releases when `T3CODE_SELF_UPDATE=true`; the tarball ships a systemd unit                     | done    |
| [26] | Pull requests and issues come from a project's `origin`, not `upstream`, unless `gh repo set-default` marks another remote (a fork listed upstream's)                  | done    |
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
| [6]  | Daily sync: a workflow rebased the patch stack onto upstream and force-pushed `main` (removed: conflicts almost every run, the rebase is done by hand)                 | dropped |
| [5]  | Claude usage limits for a setup-token session: let `rate_limit_event` stream updates fill the bars when `get_usage` is unsupported                                     | done    |
| [4]  | Project and thread switchers in the chat breadcrumb (ported from a community branch, below)                                                                            | done    |
| [2]  | GitHub Issues: read-only list and detail per project on the web (`/issues`) and in the Android app; comment, edit, label, close/reopen still planned                   | partly  |
| [1]  | Linux desktop as a Device-panel device (headless Mutter/GNOME Shell + capture + input)                                                                                 | done    |
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
[27]: #skills-manager-change-27
[30]: #synced-drafts-change-30
[33]: #saved-environments-shared-through-the-server-change-33
[40]: #other-ways-to-run-the-android-emulator-change-40
[38]: #branches-change-38
[39]: #file-operations-change-39
[36]: #github-releases-change-36
[35]: #android-catch-up-change-35
[26]: #pull-requests-from-the-fork-change-26
[25]: #in-place-updates-of-the-docker-image-and-a-bare-host-change-25

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

Icons: one icon for every platform and build, since the fork has no release channels: the Aperte glyph on the blueprint tile (`assets/dev`, also the Android launcher and splash). The upstream `prod` and `nightly` icon sets are removed. All rasters (`assets/dev/*.png`, `.ico`, `apps/web/public`) are rendered from the layer SVGs by `vp run icons:export:blueprint` (the Android ones by `icons:export:android`, with a smaller glyph; it also writes `assets/dev/blueprint-linux.svg`, which the desktop build stages as `icon.svg` and the app installs into the icon theme), because Icon Composer (macOS only) is not available here, so they approximate its glass effect and `icons:check` will not pass until they are re-exported there. The Icon Composer project only had its `text.svg` glyph swapped, so a later export keeps the blueprint background.

Caveats:

- Only the Linux x64 server archive and the unpacked Linux x64 desktop app are released (`ae-release.yml`, see "Releases (changes 7 and 9)"); no desktop installer (AppImage, deb, dmg, exe) is built or tested, so the desktop app's in-app updater finds nothing. The install scripts and `t3 update` read `SelfRef/ae-code` releases for upstream's `t3-<version>-<platform>` archives, which the fork does not publish; the release's `ae-code-linux-x64.tar.gz` is unpacked by hand. A server image does not need them: build the CLI archive from source (see the stack's Dockerfile, which follows `release-desktop.yml`'s "Build CLI archive" steps).
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

Status: done. The Device panel's local host lists a **GNOME desktop** next to Android emulators when the
server runs on Linux with GNOME Shell: a headless GNOME Shell session for testing GTK apps and Shell
extensions, watched and driven from web, desktop and Android, and by agents through `device_*` and
`agent-device`. User guide: [devices.md](./user/devices.md#gnome-desktops); internals:
[devices.md](./internals/devices.md#gnome-desktops-are-a-process-the-local-host-spawns).

- **Platform:** `"linux"` in `DevicePlatform`. Only Linux hosts list it, so other systems do not show it as missing.
  EAS and Simlock hosts never offer it. Clients older than the change reject a device state that lists a desktop.
- **Backend:** no separate service and no Docker. The local host spawns a Python helper
  (`apps/server/src/device/linuxDesktopFiles.ts`, written under the T3 home) that runs GNOME Shell with its own
  D-Bus, PipeWire and XDG dirs, drives it through Mutter's ScreenCast and RemoteDesktop D-Bus APIs, and serves
  serve-sim's formats on loopback behind a token. It runs as an ordinary child process of the server, so it works
  inside an unprivileged container (`cap_drop: ALL`, no `/dev/uinput`, no logind). Checked with GNOME Shell 50.1
  on Ubuntu 26.04.
- **Stream:** H.264 through VA-API when a render node is there (zero-copy DMA-BUF; 58 fps at 1440×900 for about 4% of
  one core on a Radeon RX 7800 XT, against about 30% for software MJPEG), else `x264enc` or `openh264enc`, else MJPEG
  only. The viewer falls back to MJPEG where WebCodecs is unavailable (plain-HTTP remote origins), as on iOS.
- **Proxy:** `/vendor/linux-desktop/` routes (stream, screenshot, input socket); the host's `upstream` sends them to the
  helper, everything else to the hub (`undefined` from `upstream` now means "the hub").
- **Agents:** agent-device's own Linux backend (AT-SPI) with `ydotool`/`grim` shims and a window-origin fix for
  Wayland; `device_open` returns a desktop-specific guide and the `t3-desktop-run` wrapper for apps an agent built.
- **Not done:** one desktop per environment (sessions of several threads share it), no SSH-host desktops, no audio,
  no clipboard sync beyond pasting text into the desktop, Xwayland only if the host installs it, iOS clients untouched.
  Windows later would be the same host interface with a VM behind it.

## Issues panel (change 2)

Goal: per project with a GitHub remote, track, read, answer, update and close its issues inside T3, the way the
pull-request views already work, without going to github.com.

### Landed: read-only Issues page and Android tab (phase A, shortened)

Built differently from the plan below, to stay small:

- **Reads go through GitHub's REST API, not GraphQL**: `search/issues?q=repo:o/r is:issue …` for the list (GitHub's own
  search syntax in the search box, 50 per page, "Load more") and `repos/o/r/issues/N` plus its first 100 comments for the
  detail (`GitHubIssueProvider.ts`; no new generated `.graphql.ts`). Pull requests that the endpoints mix in are left out.
- Contract `packages/contracts/src/issue.ts` (`IssueListInput`, `IssueSummary`, `IssueDetail`, `IssueError`), RPCs
  `issues.list` and `issues.read` (read scope), `IssueProviderApi` as an optional `issues` field of the driver
  instance, `IssueService` resolving the project's repository the way the pull-request service does. Other forges have no
  `issues` and answer "unsupported".
- **Web**: page `/issues` (the thread header's project switcher among the GitHub projects, search, Sort and Filters like
  Pull requests, list next to the issue, Markdown body and comments, "Open on GitHub"), a sidebar button and a
  command-palette action, both shown only when a project is on GitHub. Sort (`IssueListInput.sort`: updated, newest,
  oldest, comments) goes to GitHub's search; "created by me" and "assigned to me" are its `author:@me` and `assignee:@me`.
- **Right panel**: an "Issues" tab (add menu, key `I`) lists and reads the thread's project issues beside the chat, same
  list and detail as the page. Offered when the thread's project is on GitHub.
- **Android**: an Issues tab next to Threads, Pulls and Usage. `SplitPage` shows the open issue (or release) beside the list
  once the page is 640 dp wide, such as unfolded, and replaces the list below that. Sort, state and "mine" chips match the web. Settings → Navigation chooses which tabs show; Pulls is
  hidden by default (the choice is saved once changed).
- Not built: everything that writes (phase B), MCP tools (C), threads from issues (D), iOS.

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
7. **Mobile:** the fork builds and signs its own Android app (change 9), so the Android app carries an Issues tab (see
   above). iOS has no build of the fork. The contract stays client-agnostic.

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

## Daily sync (change 6, dropped)

A scheduled workflow used to rebase `main` onto upstream every day. It was removed: the rebase almost never went through
without conflicts, so the sync is done by hand with the procedure in the last section.

- **Only `ae-*.yml` workflows run on this fork.** Upstream's use runners (`blacksmith-*`) and secrets a fork does not
  have, so their jobs would queue forever. A rebase never touches the setting, so after one that brings in a new
  upstream workflow, disable it: `gh workflow list --all`, then `gh workflow disable <id>`.
- **Releases are started by hand** (`gh workflow run ae-release.yml --ref main`) after the push.

## Releases (changes 7 and 9)

`.github/workflows/ae-release.yml` is started by hand (`force` releases an unchanged
`main`). It publishes a GitHub release when `main` is not the commit of the latest release. Upstream's `release.yml` is
not used: it needs `blacksmith-*` runners, relay and Clerk configuration, signing secrets and the Play APK. The `cli` job
repeats the CLI archive steps of upstream's `release-desktop.yml` (build, resource monitor, `build-cli-archive.ts`,
smoke test) on a GitHub-hosted runner, without Electron; that workflow itself is not called, so it stays
disabled.

- **Versions:** tag and title `vYYYY.MM.DD`, then `vYYYY.MM.DD.1`, `.2` for later releases the same day. The apps need a
  semver, so the packages (and the updater feed) carry `YYYY.MMDD.N`: `2026.1109.0` for `v2026.11.09`. It increases
  with every release, which is all the updater needs.
- **Release notes:** `docs/CHANGELOG.md` (Keep a Changelog), the section named after the release's tag, else
  `[Unreleased]` (`scripts/release-notes-section.sh`); the `prepare` job fails before building when both are empty.
  Under it: the upstream commit the release sits on, and a collapsed "Full changelog": a compare link between the two
  upstream commits (`pingdotgg/t3code`) and the fork patches that release did not have. A patch counts as new by its
  subject, because every rebase rewrites the hashes, so a fixup that keeps the subject is not listed (`fixup!` commits
  are left out). The first release lists every patch. The full list is the table above. Entries go under
  `[Unreleased]` in the commit that lands a user-visible change; the `release` job moves them under the tag's
  heading (`## [vYYYY.MM.DD] - date`, `scripts/changelog-release.sh`), commits that to `main` as `chore(release): <tag>` and
  tags that commit, then publishes. The commit is not in your checkout until you pull: rebase onto it before the next push.
  Fork patches named `chore(release): ...` are left out of the "Full changelog" list.
- **Contents:** `ae-code-linux-x64.tar.gz`, the Linux x64 server: the single executable `ae-code` with the web client,
  the resource monitor and its own libatomic (`ae-code serve`). Upstream's archive is `t3-<version>-linux-x64.tar.gz`
  holding `t3`; the workflow renames both after the smoke test, because the server's update and install code looks for
  upstream's names and the fork's source is left alone. The file name has no version so that
  `releases/latest/download/ae-code-linux-x64.tar.gz` always points at the newest one. The executable still calls itself
  `t3` in its help text.
- **Desktop archive:** `ae-code-desktop-linux-x64.tar.gz`, the Linux x64 desktop app unpacked (electron-builder's `dir`
  target: the `ae-code` Electron executable and its resources, no AppImage or deb), built by the `desktop` job without
  signing, relay or Clerk configuration. The AUR packages `ae-code`, `ae-code-bin` and `ae-code-git` repackage it
  (`ae-code-bin`) or build the same target from source. The release waits for this job.
- **Android (change 9):** the `android` job runs after the release exists and attaches `ae-code-<tag>-arm64-v8a.apk` (phones) and
  `ae-code-<tag>-x86_64.apk` (emulators) to it, so an Android failure never withholds the rest. The two are matrix
  jobs, built independently and in parallel (a cold build of both together took about 40 minutes), and one failing
  leaves the other attached. Each runs `expo prebuild` and `gradlew assembleRelease` with `APP_VARIANT=production` for
  its one ABI, with Gradle's dependency cache kept between runs and Expo's cloud updates off. Native libraries are
  stored deflated (`useLegacyPackaging`): the download shrinks, the install is extracted. Then the APK is re-signed
  with the fork's key
  (Expo's template signs release builds with the public debug key). The version name is `YYYY.MMDD.N`, the version code
  `YYMMDDNN`. The production Android package is `dev.aperte.aecode` and the name AE Code (`apps/mobile/app.config.ts`),
  so it installs beside upstream's app; the `t3code` URL scheme is kept. There is one Android icon for every build: the blueprint tile with the Aperte glyph
  (adaptive, monochrome, splash and notification glyph; the production build uses the dev assets). The release build has
  no suffix and no badge; the dev and preview builds are named AE Code Dev and AE Code Preview and show the same
  word as a badge in the header (`resolveMobileStageLabel`). `icons:export:android` renders the foreground
  and splashes from the same `text.svg` as the other icons. The app's own name in its screens, permission prompts,
  widgets and notifications says AE Code ("T3 Connect" and "T3 Account" keep upstream's names: they are its hosted
  service). Saved images go to `Pictures/AE Code`. Thread links on
  `app.t3.codes` still open a chooser because that domain only lists upstream's package.
- **Secrets for Android:** `ANDROID_KEYSTORE` (base64 of a PKCS12 keystore; its first key is used, whatever the alias)
  and `ANDROID_KEYSTORE_PASSWORD` (store and key share it in PKCS12). Create the key once and keep it: an update must be
  signed with the same key as the installed app.
  `keytool -genkeypair -keystore ae-code.jks -alias ae-code -keyalg RSA -keysize 4096 -validity 36500`.
- **AUR (change 9):** the `aur` job runs after the release exists and runs `scripts/ae-aur.sh` in an Arch container: for
  `ae-code` and `ae-code-bin` it sets `pkgver` to the tag without the `v`, resets `pkgrel`, refreshes the checksums
  (`updpkgsums`) and `.SRCINFO` and pushes to the AUR as commits by the repository owner. `ae-code-git` follows on its
  own, and a packaging change (dependencies, files, build steps) is still made by hand. Secret `AUR_SSH_KEY`: the
  passphrase-less private SSH key of an AUR account that is a co-maintainer of both packages (add its public key in that
  account's AUR profile). A failure leaves the release in place; rerun the failed job. `scripts/ae-aur.sh <tag> --dry-run`
  commits without pushing.
- **Not built:** the desktop app as AppImage, `.deb`, macOS or Windows, iOS, arm64 server; no relay or Clerk configuration
  (T3 Connect sign-in is absent, pairing with a server works as before), no npm launcher, no tests or checks. A broken
  `main` shows as a failed build.
- **First run:** started by hand from the Actions tab. The Android build took about 40 minutes with a cold cache; that
  is what to expect when Gradle's cache is evicted (GitHub drops caches unused for 7 days).

## Docker image (change 8)

The `image` job of `ae-release.yml` wraps the release's Linux x64 server archive in `packaging/docker/Dockerfile` and
pushes `ghcr.io/selfref/ae-code:<YYYY.MM.DD[.N]>` and `:latest`. Nothing is built from source in the image: it is Ubuntu
24.04 (the archive is built on that glibc), `git`, `ssh` and the archive in `/opt/ae-code`, a non-root user (uid 1000),
state in `/home/ae/.ae` (a volume), port 3773, started with `ae-code serve`. It also carries the source-control CLIs
`gh`, `glab`, `fj` and `gt`, fetched as pinned release binaries in a build stage (`ARG`s at the top of the Dockerfile;
`gh`, `glab` and `gt` are checked against their published checksums, `fj` publishes none). It is a base image meant to be
extended: agent CLIs, toolchains and the Android SDK are left out, and the README shows a derived image.

A package GitHub creates starts private: after the first push, make `ae-code` public in the package settings (Package
settings, Change visibility). Checked locally by building it around an upstream archive and starting the server.

In-place updates are off by default; see "In-place updates of the Docker image and a bare host (change 25)".

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
- Copy: the About → Legal description, `docs/user/telemetry.md` and `docs/user/faq.md` say the
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
- Existing per-thread selections in `t3code:diff-panel-state:v1` are kept; only the default changed. Upstream (#22347)
  keeps the selection across navigation, so the panel no longer resets to the default each time it opens.

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

## Skills manager (change 27)

Goal: see and manage the skills of every provider in one place, without a skill format of our own. A skill stays an
open-spec `SKILL.md` folder that each provider loads natively, so the composer's `/` and `$` menus, name rewriting and
progressive loading keep working. Research and the upstream PRs this draws on: [FORK_REFERENCES.md](./FORK_REFERENCES.md#skills).

### Findings in the source

- Discovery exists for Claude, Codex, Cursor, Grok, fx, Antigravity and OpenCode; each provider snapshot carries
  `skills: ServerProviderSkill[]` (`name`, `path`, `scope`, `enabled`, ...). Pi, Kiro and the generic ACP providers list
  none.
- Providers read different global folders. `~/.agents/skills` is read by Codex, Cursor (its own discovery code), OpenCode
  (its docs), fx (its discovery code) and Pi (its docs). Claude (`<claude home>/skills`), Antigravity
  (`~/.gemini/config/skills`, its code ignores `~/.agents`), Grok (`~/.grok/skills`) and Kiro (`~/.kiro/skills`) do not.
- A provider's home is the server process's `HOME`, unless the instance sets `homePath` (Claude's `CLAUDE_CONFIG_DIR`).
  Discovery already resolves it per instance (`resolveClaudeHomePath`); the manager reuses that. In a container whose
  `HOME` is a volume the same code runs unchanged. Nothing is shared between environments.
- Claude keeps account-synced skills under `<claude home>/skills/synced`, and plugin and built-in skills have their own
  roots. They belong to their provider: never moved, linked or deleted.

### Built

- **Library:** `<HOME>/.agents/skills`, one folder per skill, per environment. `SkillLibraryService`
  (`apps/server/src/skills`) lists it with, for every enabled provider instance, a state: `native` (reads the library),
  `linked`, `missing`, `blocked` (the provider's folder has something else of that name) or `unsupported`.
- **Links:** a relative symlink from the provider's skills folder to the library folder, so it also resolves when the
  volume is seen from another mount. Never replaces a real folder, file or foreign link; a link is removed only when it
  provably points at that skill.
- **Management:** create (name per the Agent Skills spec, generated `SKILL.md`), edit `SKILL.md`, remove to a trash
  (`~/.agents/.skills-trash`, 14 days) that also takes the links away, restore with the links it had. A folder that is a
  link elsewhere is not written through. Mutations are serialized by one semaphore and `SKILL.md` is written atomically.
- **Install and update:** `owner/repo`, `owner/repo@skill` or an https or ssh git URL (local paths, `file:` and `ext::`
  are refused), optional ref. A shallow fetch into a staging folder, with `GIT_ALLOW_PROTOCOL=https:ssh` and
  `core.symlinks=false`; skills are the folders with a `SKILL.md` up to four levels down; files are copied (links
  skipped, at most 2000 files and 20 MB). The source, ref, commit and folder are kept in `~/.agents/.ae-skills.json` (no
  database table, `ServerSettings` untouched); update fetches again and replaces the skill when the commit moved.
- **Contracts and permissions:** `packages/contracts/src/skillLibrary.ts`, nine `skills.*` RPCs. List and read need
  `orchestration:read`; every write, and inspecting or installing a source, needs `filesystem:write`. The client sends
  folder ids, never paths.
- **Agent tools** (`apps/server/src/mcp/toolkits/skills`): `t3_skill_list`, `t3_skill_read`, `t3_skill_write`,
  `t3_skill_remove`, `t3_skill_link`, each a call into the service. The two reads are open to any thread and are on the
  Claude read-only allowlist. The three writes work only in a thread in full access: T3's own MCP tools are pre-approved
  for Claude (`mcp__t3-code__*`) and there is no per-tool approval prompt, so the gate is the thread's own trust level
  (in full access an agent can write any file anyway). A per-write approval card would be a new turn-item type like the
  secret request. Install and update are not tools. The tool list grew by 1782 bytes (`agentContextBudget.json`).
- **Import** (like change 13's import from Claude): scans every linkable provider's own skills folder for real folders
  with a `SKILL.md` (links, folders without one such as Claude's `synced`, and plugin skills are not offered). Copy
  leaves the original; move renames it into the library (same disk) and leaves a relative link, so the provider keeps
  the skill. A name the library has is refused.
- **Claude uses only the library's skills** (like change 13's native-memory switch, all or nothing): the setting lives
  in the lock file. `SkillLibraryService` publishes, per Claude instance, the names of the library skills linked for
  it to `packages/provider-core/src/server/skillPolicy.ts` (process-wide, refreshed on start and after every change
  and list), and `ClaudeAdapterV2` passes them as the SDK's `skills` option for new sessions. That hides Claude's own,
  plugin and bundled skills from the model. The chat's skill menu is filtered to the same names (`ClaudeDriver` for the
  snapshots, the adapter for slash dispatch), so it does not offer what the model cannot see. Every library change
  refreshes each provider's snapshot and its project snapshots, which otherwise keep five minutes. An empty list passes
  a name no skill has, because an empty array may be read as no filter. New sessions only; a link or skill added outside T3 counts after the next change or list.
- **Settings → Skills** (web and desktop, one environment at a time): the library with a switch per linkable provider,
  an editor, create, install, trash, and a read-only list of what providers load from their own folders (from the
  provider snapshots). User guide: `docs/user/skills.md`.

### Not built

- **Per-skill switches** (Claude `skillOverrides`, Codex `[[skills.config]]`, OpenCode `permission.skill`): a provider
  that reads the library itself always has it, and Claude's switch below is all or nothing. Taking one skill away from
  one provider would mean changing three adapters and their replay fixtures.
- Phase "read-only list from the snapshots" was skipped: symlinked skills have different paths per provider in the
  snapshots, so the list is read from the filesystem and the snapshots only feed the last section.
- Project skills; a skills.sh search or catalog (a source must be named); removing a provider's own skills (import and the Claude switch
  cover moving them); update checks without fetching; Windows junctions (relative symlinks need developer mode there).
- A per-write approval card for the agent tools; a `t3_skill_load` for providers with no native skills; a read-only bind
  mount of a host library; sync between environments (upstream PR #24377); bundled workflow skills; a mobile page (like
  memory, Settings pages are web and desktop).
- **Not verified:** the Grok and Kiro folders come from `npx skills`' table, and Pi and OpenCode reading `~/.agents/skills`
  from their docs; the page was checked by hand for listing, creating and editing only (not links or install), and the agent
  tools were not run against a real model (`evals/mcp-tool-use` needs paid keys, not run).

### Rebase cost

New files only for the feature: `packages/contracts/src/skillLibrary.ts`, `apps/server/src/skills/*`,
`apps/web/src/components/settings/Skills*` and `skillsSettings.logic*`, the route. Touch points of a few lines:
`settingsSearch.ts`, `SettingsSidebarNav.tsx`, `_chat.settings.tsx`, the generated `routeTree.gen.ts`, the contracts
index, `rpc.ts`, `clientRpcPermissions.ts`, `RpcAuthorization.ts`, `RpcInstrumentation.ts`, `ws.ts`, `server.ts`,
`ws.test.ts` and the client-runtime `server.ts`. Upstream may land its own version (PRs #21815 to #21817).

## Pull requests from the fork (change 26)

`RepositoryIdentityResolver` named a checkout's repository after its `upstream` remote when it had one, then `origin`,
so a project cloned from this fork listed upstream's pull requests (and grouped with upstream's other checkouts).

- `origin` now comes first, then `upstream`, then the first remote by name. The identity's `origin` field (the fork next
  to its upstream) is therefore empty for a checkout that has both: the identity already is the fork.
- gh's default-repository mark (`gh repo set-default`, stored as `remote.<name>.gh-resolved`) still wins over that
  order, as upstream implements it: a checkout marked on `upstream` lists upstream's pull requests, issues and
  releases until `gh repo set-default <owner>/<fork>` marks the fork. The fork does not override the mark.
- gh's own repository choice in the GitHub provider (`upstream`, `github`, `origin`) is left as is: it only mirrors what
  `gh pr create` does in the checkout.

## In-place updates of the Docker image and a bare host (change 25)

Upstream's remote update path needs an npm package, a boot service or the desktop app, and its Settings → About offered
a Stable/Nightly "Update track". The fork publishes one stream of GitHub releases (`vYYYY.MM.DD`) and its server runs
in a container, so none of that applied.

- **Switch:** `T3CODE_SELF_UPDATE=true` on the image. The image's entrypoint (`packaging/docker/entrypoint.sh`) then
  sets `T3CODE_UPDATE_SUPERVISED=1` for the server, which is what makes the server report the existing `respawn`
  self-update capability. Without the switch the entrypoint `exec`s the server as before and Settings → About says
  that updates are off. A server nothing supervises never gets the capability, because nothing would start it again.
- **Bare host:** with the same switch, `ae-code serve` (packaged executable only) stays up as a small parent
  (`apps/server/src/cloud/updateSupervisor.ts`, started from `bin.ts` before the CLI loads) and runs the server as a
  child with `T3CODE_UPDATE_SUPERVISED=1`. It does what the entrypoint does: it starts the child again only after
  `<home>/updates/current` moved or on SIGHUP, runs the newest of its own build and the download, and falls back to its
  own build when a download does not start. It finds `<home>` from `--base-dir`, `T3CODE_HOME` or `~/.ae`, like the
  server. The shell loop in the entrypoint is left as is, so the image is unchanged.
- **Tarball:** `ae-code-linux-x64.tar.gz` also holds `install.sh`, `ae-code.service` and `INSTALL.md`
  (`packaging/systemd/`, copied in by the release workflow). `install.sh` installs a systemd user service with the switch
  on, links `~/.local/bin/ae-code` and enables lingering; running it from a newer archive updates by hand.
- **Check:** `server.npmRelease` (the RPC keeps upstream's name) answers `latest` from
  `api.github.com/repos/SelfRef/ae-code/releases/latest`, tag `v2026.11.09` read as version `2026.1109.0`. Anonymous
  GitHub requests are limited to 60 an hour per address; the answer is cached for a minute.
- **Install:** About → Install calls the existing `server.updateServer`. The server ignores the client's `targetVersion` (a local build's
  version is no release) and installs the newest release: it
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

## Worktree defaults (change 28)

Defaults for working on several features at once, one worktree per thread. Only the decoding defaults in
`packages/contracts/src/settings.ts` changed; a value already saved in `settings.json` wins.

- Branch naming: semantic prefix (`feat/`, `fix/`), not `t3/`.
- Start from remote: off, so a worktree branches from the local base branch, which can be ahead of `origin`.
- Cleanup: delete worktrees of merged pull requests, of deleted threads and with no commits beyond the default branch, and
  3 days after a thread settles. Worktrees with uncommitted changes are kept; branches and thread history always are.
- No data migration: no key was renamed.

## Appearance defaults (change 29)

Decoding defaults in `packages/contracts/src/settings.ts`; a saved value wins.

- Environment identification: `dev-artwork` (was `artwork`, which shows art only on Dev builds). The Nightly artwork (the
  `nightly-artwork` mode, its picker entry and its SVG) is gone, since the fork has one channel. A stored
  `nightly-artwork` value no longer decodes, so reset it to a current mode. The Nightly version pill stays.
- Panel animations: 100 ms (was 0).
- Composer context: on (was off).
- New client setting `showVersionInHeader` (Settings → Appearance → Advanced, on by default): the server version beside
  the name in the sidebar header.
- No data migration: no key was renamed.

## Synced drafts (change 30)

Goal: a draft written on one client shows on every other client of the same environment: unsent text in an existing thread
and whole new-thread drafts (project, branch, worktree mode, model, attachments, contexts). Web, desktop and Android.
Status: planned, not started. Decisions taken with the owner: Android is in this change, and when two devices edit the
same draft **the device you are typing on wins**.

### Findings in the source

- **Drafts never leave the client.** Web and desktop keep them in `localStorage` (`t3code:composer-drafts:v1`, store
  version 9, `apps/web/src/composerDraftStore.ts`); Android keeps its own file with its own shape
  (`apps/mobile/src/state/use-composer-drafts.ts`). The server has no draft concept.
- **Web store:** `draftsByThreadKey` (composer content, keyed by scoped thread key for an existing thread or by `DraftId`
  for a new one), `draftThreadsByThreadKey` (the new-thread session: project, environment, branch, worktree path, env mode,
  `startFromOrigin`, runtime and interaction mode, `promotedTo`) and `logicalProjectDraftThreadKeyByLogicalProjectKey` (the
  one draft a project's "new thread" reopens). **Android:** a flat map keyed by scoped thread key or `new-task:<id>`, with
  `project` and `workspaceSelection`.
- **Attachments are the hard part.** Web images persist as base64 data URLs; files persist as markers because a `File`
  cannot serialize. Both already upload to the server as _pending_ attachments when attached (`attachmentUploadQueue.ts`),
  but the server deletes a pending attachment after 24 h (`PENDING_ATTACHMENT_MAX_AGE_MS`), which is why an old draft shows
  "Uploaded file expired" today. Android keeps files in its document directory.
- **A cross-client context model already exists.** `ComposerContextRecord` in `packages/contracts/src/composerContext.ts`:
  image and file records reference attachment ids (never bytes), plus terminal, element, preview-annotation,
  review-comment, mention, skill, thread and environment records, all in a `ForwardCompatibleArray` (an unknown kind stays
  an opaque record). Web's prompt stash and Android's drafts already store it, and the stash has the draft-to-records and
  records-to-draft conversion to reuse.
- **Prior art, upstream PR #26273 (closed 2026-10-30, only for missing test evidence, not for the design):** a
  `composer_drafts` table, a `composerDrafts` subscribe stream (`snapshot` then `upsert`), a batched `put`, a pure
  `decideComposerDraftSync` (last write wins, a never-stamped local draft keeps its text, a tombstone beats older text),
  keys `thread:<id>` and `new-task:<id>`. It synced text, model, runtime and interaction mode only; attachments stayed on
  the device. Its author asked whether it should be on by default; this change says yes (below). No fork has it (searched
  2026-11-10: the feature index, upstream issues and PRs). The shape is ported, the attachments, contexts and web
  new-thread sessions are new.

### Design

- **Where drafts live: on the server of the draft's environment.** An existing-thread draft goes to the thread's
  environment, a new-thread draft to its session's `environmentId` (changing a draft's environment deletes it on the old
  server and puts it on the new one). A client connected to several environments syncs each separately; nothing is
  copied between servers. Desktop and web need to reach the same server to share a draft, which is the case for this
  deployment; a desktop that hosts its own local server shares with nobody else.
- **Storage:** a `composer_drafts` table created with `CREATE TABLE IF NOT EXISTS` by a new service at start, not a numbered
  migration (as change 13: upstream's PR took migration 073, which would collide with the next one it adds). Columns:
  `draft_key` (primary key), `revision` (integer from a per-environment counter), `updated_at`, `deleted`, `payload_json`.
  A tombstone is kept 30 days so a device that was offline cannot bring a deleted draft back, then purged. Caps: 500 live
  drafts, payload 256 KiB (attachments are references).
- **Contract** (`packages/contracts/src/composerDraftSync.ts`): `SyncedComposerDraft` = `key`, `prompt`, `records`
  (`ForwardCompatibleArray(ComposerContextRecord)`, images and files by attachment id), `modelSelection`, `runtimeMode`,
  `interactionMode`, `session` (new-thread drafts only: `projectId`, `threadId`, `branch`, `worktreePath`, `envMode`,
  `startFromOrigin`, `createdAt`, plus Android's `pullRequestReference` and `followsCurrentCheckout`), `revision`,
  `updatedAt`, `deleted`, `promotedTo`. Keys are `thread:<threadId>` and `draft:<draftId>`; web's `DraftId` and Android's
  `new-task:<id>` both map to the second, so a new-thread draft written on one client opens on the other. The pure
  `decideComposerDraftSync` lives next to it, so web and Android share one rule and one test table.
- **RPCs:** `composerDrafts.subscribe` (stream: `snapshot`, then `upsert` per change, a fresh snapshot after every
  reconnect) and `composerDrafts.put` (at most 32 drafts per call, each with the `baseRevision` the client last saw; the
  reply says `accepted` with the new revision or `conflict` with the current draft). Both need the operate scope (a guest
  or read-only client must not read someone's unsent text); listed in `CLIENT_GUARDED_RPC_SCOPES`.
- **Conflicts: the typing device wins.** A put with a stale `baseRevision` gets `conflict`. A client applies a remote
  change to any draft it has no unsent edit of and whose composer is not focused. For a draft being edited it keeps its
  text, adopts the remote revision as its base, and its next save overwrites (last write wins per draft, no text
  merge). When the composer blurs, a draft that still equals its last saved version takes the held remote one.
- **Sending and discarding:** sending an existing-thread message, discarding, or promoting a new-thread draft writes a
  tombstone (promotion sets `promotedTo`). Another client showing `/draft/<id>` follows `promotedTo` to the thread through
  the store's existing `promotedDraftRedirects`, and drops the draft otherwise. A discard's Undo puts again against the
  tombstone's revision. Clearing never resurrects older text because a tombstone outranks it by revision.
- **Attachments:** bytes stay on the server, drafts carry ids. The server's pending-attachment sweep gets a keep set:
  every attachment id a live draft references is skipped, so a draft's attachments outlive 24 h and go when the draft is
  sent (the existing claim moves them to the thread), discarded or purged. Web stamps an image's attachment id on the draft
  once its upload finishes (files already do, `setFileUpload`) and keeps its data URL locally for offline use; a device
  that receives a record it has no bytes for downloads it once into a `File` and marks the upload `ready`, so sending does
  not upload it again. Android does the same through its upload queue and `attachmentDownload.ts`. A missing attachment
  goes through the existing "expired" path. A draft's attachments count against server disk until the draft is sent or
  discarded.
- **Client sync layer, web:** one new file (`apps/web/src/composerDraftSync.ts`, installed from `appInit.tsx`) watches the
  store by reference, pushes changes debounced at 600 ms per environment, and applies remote drafts through two new store
  actions (`applySyncedDraft`, `applySyncedTombstone`). None of the store's ~60 mutations change, and the store version
  stays 9. Per-draft sync state (`revision`, last saved signature) lives under its own key
  (`t3code:composer-draft-sync:v1`). The project's "new thread" pointer is not synced; a received new-thread draft sets it
  only when the project has none, or when the received draft is newer. **Android:** the same layer in
  `apps/mobile/src/state/composer-draft-sync.ts` over its atoms.
- **First run after the update:** each environment's local drafts that have no sync state are put (a union; ids are unique,
  so two devices' separate drafts both show). A draft nobody changed since is not re-put. No data is renamed or moved, so
  the "Data migration" table needs no row.
- **Surfaces.** Web and desktop: sidebar drafts, the "unsent draft" marker, side chats (they are real threads, so they
  take the thread path). Android: the new-task draft screen and thread composers. Providers: not involved. Agents: no
  tool (a draft is the owner's text, not an action). Connection modes: one websocket stream per environment, so local,
  relay and tunnel are the same path. Reverse state: discard and Undo above.

### Phases

- **A. Server and contract.** Contract and `decideComposerDraftSync` with its table test; `ComposerDraftSyncService`
  (table, revisions, tombstones, purge, snapshot and upsert stream) with service tests; RPC wiring and scopes; the
  sweep keep set. One commit per concern.
- **B. Web and desktop, text and sessions.** Sync layer, the two store actions, promotion redirect, the editing hold. Tests:
  the decision table, the sync layer against a fake stream (conflict, hold and release, tombstone, first-run union), and
  one browser test for the redirect.
- **C. Web attachments and contexts.** Image stamping, receive and download, records both ways through the stash's
  conversion. Check the size of preview-annotation and terminal records in a draft against the 256 KiB cap.
- **D. Android.** The sync layer, `ComposerDraft` to and from the document, uploads and downloads.
- **E. Docs.** A short section in `docs/user/composer.md`, this section turned from plan to "Built", an index row in
  `FORK_REFERENCES.md`.
- **Checks.** One pass in a real client per `AGENTS.md`: two browser tabs against a dev server with the Replay provider
  (type in one, see it in the other; promote; discard; attach an image), then `test-t3-mobile` for Android.

### Not built

- Merging concurrent text edits; draft history; replicating a draft to another environment's server.
- A switch to turn sync off. Drafts are stored in the server's database next to thread history; add a per-client setting
  if terminal context in a draft ever needs to stay on the device.
- The prompt stash (a separate list of saved prompts), sticky model picks and other per-client preferences.
- Per-user drafts: every session with the operate scope of an environment shares its drafts, which is right for one
  owner and wrong for a team server.

### Rebase cost

New files: `packages/contracts/src/composerDraftSync.ts`, `apps/server/src/composerDrafts/*`,
`apps/web/src/composerDraftSync.ts`, `apps/mobile/src/state/composer-draft-sync.ts`. Touch points of a few lines:
`rpc.ts`, `clientRpcPermissions.ts`, `RpcAuthorization.ts`, `RpcInstrumentation.ts`, `ws.ts`, `server.ts`, the contracts
index, client-runtime `rpc/client.ts` and `state/server.ts`, `appInit.tsx`, the mobile `App.tsx`, `composerDraftStore.ts`
(two actions), `attachmentStore.ts` (the keep set) and `attachmentUploadQueue.ts` (stamp images). Upstream may land its own
version: its PR #26273 was closed for evidence, not rejected.

## Move a thread into a worktree (change 31)

The workspace control locked once a thread had messages, so a thread started on the local checkout could never get a
worktree. An idle thread without one can now move into a new worktree: the picker unlocks for it, and the thread menu
has **Move to new worktree**. Both call the `threads.moveToWorktree` RPC, gated by the `threadMoveToWorktree`
capability so older servers do not offer it.

- The server reuses the agent's `t3_worktree_handoff` path (`WorktreeMcpService.moveThread`): a worktree branched from
  the project's checked-out branch, the thread re-pointed at it (which detaches its provider session), the setup script
  started. The branch is a temporary `t3/<hex>` name, as for a new thread; there is no model-written name.
- One instance serves both entry points, so a single per-thread guard stops an agent handoff and a UI move from both
  creating a worktree.
- Rejected while the thread has a queued or running turn, is archived, or already has a worktree.
- Uncommitted changes in the local checkout are left there, not copied.
- Web and desktop only; mobile does not offer it. The command palette has no per-thread actions, so the thread menu is
  the second entry point.
- No data migration.

## Merge into the default branch (change 32)

Own projects merge to the default branch and push instead of opening pull requests. Two stacked Git actions, `merge`
and `merge_push` (both commit pending changes first), plus a project-scoped setting `quickMergeAction`
(`merge` by default; `pull_request` restores the pull request button) that makes one of them the main button.

- Logic is `apps/server/src/git/mergeIntoDefault.ts`, run from `GitManager.runStackedAction` as a `merge` phase.
- Fast-forward only: rebase the branch onto the default branch if it moved, then `merge --ff-only` in the default
  branch's own checkout, which must have no tracked changes. A default branch checked out nowhere is advanced with
  `git fetch . branch:default`. A rebase conflict is aborted and reported; nothing is left half-done.
- The push goes to the default branch's configured remote branch, or the primary remote's same-named branch.
- When a merge fails (a rebase conflict, a dirty default checkout) and the session may operate threads, the server hands it
  to the thread's agent (`apps/server/src/git/handOffMerge.ts`, wired in `ws.ts` through `GitManager`'s `handOffMerge`
  option). It dispatches a server-created `system` notice carrying the error and the steps (rebase, resolve conflicts,
  fast-forward the default branch, push if the action pushed), like compaction runs as its own turn, and holds the action
  open until that run ends, so the Merge button keeps its progress ("Merging by agent...") on web and mobile alike. The
  result's toast only points at the thread; without operate access, when the hand-off cannot start, or with the
  project setting `mergeByAgentEnabled` off (Settings → Source control, on by default), the failure is reported as
  before. `mergeByAgentModelSelection` (off by default: the thread's own model) picks a coding agent for the turn. Nothing
  is retried automatically.
- Not cleaned up here: the existing worktree cleanup removes merged branches' worktrees.
- Its own button: the actions live in a **Default branch** section of the thread details card (off by default, shown with
  the card's show/hide list, only on a branch other than the default one), not in the Git actions menu. The button
  merges (`merge_push` when the project's `quickMergeAction` says so); under its arrow are Merge & push and
  **Push n commits**. With nothing to merge, a push of the default branch is the button. `pull_request` for
  `quickMergeAction` no longer means anything and reads as `merge`.
- `push_default` is a third stacked action: it pushes the default branch as it is (`mergeIntoDefault` with `pushOnly`),
  without rebasing or fast-forwarding. The count comes from `defaultAheadCount` in the remote part of the status: commits
  the local default branch has that its upstream (else `origin/<default>`) does not. Absent from older servers, which also
  do not know the action.
- Android has no card to show or hide: the Git menu gets a Default branch entry with the same primary action, and the Git
  sheet a **Default branch** list (Merge, Merge & push, Push n commits). Its project setting lost the pull request choice too.
  Older servers do not know the actions, and the result's `merge` field is optional for the same reason.
- No data migration: a new setting with a default, and a new key in the sparse `threadDetailsItems` setting.

## Saved environments shared through the server (change 33)

The web client kept its saved environments (and their bearer tokens) in the browser's IndexedDB, so each browser started with
only the environment that served the page. Now the browser keeps the part every device can use on the server it was served
from, and other browsers signed in to that server load it.

- **What is shared:** bearer connections (target, profile, token) whose route is not the device's own loopback, and which of
  them are switched off. **What is not:** T3 Connect (relay) routes and their DPoP tokens (bound to a per-browser key), SSH
  routes (desktop only), loopback routes, and pull-request routing trust, which stay per browser.
- **Server:** `GET`/`PUT /api/connection-catalog` (`EnvironmentConnectionCatalogHttpApi`), both gated by `access:write`
  because the document holds other environments' tokens. `ConnectionCatalog` keeps one opaque JSON document with a revision
  in the secret store (`connection-catalog`), at most 1 MiB. A write must name the revision it read; a stale one is refused
  (`connection_catalog_conflict`).
- **Client:** `withSharedCatalog` wraps the IndexedDB catalog backend (`apps/web/src/connection/serverCatalogBackend.ts`).
  The IndexedDB copy stays as the offline cache and the home of the device-bound part. A change that leaves the shared part
  alone (a refreshed DPoP token) never calls the server. On a conflict the catalog store reloads and applies the change
  again on top of the server's copy.
- **First sync:** a browser that never synced adds the entries only it has to the server's copy. After that the server's copy
  wins, so removing an environment on one browser removes it on the others at their next load.
- **Degrades to local:** a server without the endpoint, a session without `access:write` and a signed-out page keep the old
  behaviour for that page. When the server is only unreachable, a change to the shared part is refused instead of saved on
  one browser, where the next load would drop it.
- Web only. Desktop keeps its own catalog and mobile its own storage. Another browser sees a change at its next load, not
  live.
- No data migration: the server's copy is created by the first browser that syncs.

## Thread actions in the thread details card (change 34)

The last section of the thread details card: a split button, **Settle thread** (**Un-settle thread** once settled) and an
arrow that opens the thread's context menu (`useThreadActionMenu`, the one the header and right-click open). Shown on by
default for server threads at full card density; **Thread actions** in the card's show/hide list turns it off.

- Code: `apps/web/src/components/chat/ThreadDetailsActions.tsx`. Settling goes through `settleAndAdvance` like the keybinding.
- The menu's Rename starts the header's inline rename through the `threadRename` registry (`apps/web/src/threadRename.ts`),
  so it does nothing when no header is mounted.
- No data migration: a new key in the sparse `threadDetailsItems` setting, absent meaning the default.

## Branches (change 38)

A page that answers "was this merged yet?": a project's branches and worktrees with how far each is from the default
branch and from its own upstream. Read-only; nothing here switches, pulls, pushes or deletes.

- **Server**: one RPC, `vcs.branchOverview` (read scope; contract `packages/contracts/src/branchOverview.ts`), a method on
  `GitVcsDriver` (`branchOverview`, parsing in `apps/server/src/vcs/branchOverview.ts`). It reuses the ref snapshot behind
  `vcs.listRefs` (local branches, remote-only branches, worktree paths, default branch) and adds one `for-each-ref` for
  commit date, subject, upstream and `upstream:track`, and one `rev-list --left-right --count` per branch against the
  default ref. The default ref is the local default branch when it exists (merges land there before they are pushed), else
  `origin/<default>`. At most 200 branches come back, default first and then by latest
  commit; `truncated` says more exist.
- **Fresh counts**: the clients ask with `fetch: true`, which goes through the Git status poll's throttled fetch
  (at most one per 15 s, backing off on failure), so ahead and behind follow the remote without a fetch storm. Offline,
  the counts are those of the last fetch.
- **Entries** are "Branch" (plain local), "Worktree" (checked out in a linked worktree, not the main checkout) or
  "Remote only". Highlighted: a branch with commits the default lacks ("N ahead of main", warning tint). A branch
  with none is "Merged". Each row also shows commits to push and to pull, "Not pushed" without an upstream, and
  "Upstream deleted".
- **Threads**: a row links to the newest live thread of that project working on it (in that worktree, or on that branch in
  the project root). Matching is client-side (`threadForBranch` in `packages/client-runtime/src/branchOverview.ts`);
  remote-only branches have no thread.
- **Remotes**: `vcs.branchOverview` takes `remote` (a remote's name, or `*` for all) and answers with `remotes` (primary
  first) and the `remote` it listed. Unset is the primary remote (`origin`, else the first), because the 200-branch cap
  applies after this filter: a fork's `upstream` has thousands of branches and would crowd out the project's own.
- **Web**: page `/branches` with the project switcher of the thread header (`ProjectPageHeader`, shared with Issues and
  Releases; it opens on the project of the last opened chat), search, Sort (latest/oldest commit, most unmerged, name) and
  Filters (merge state, kind, remote), a sidebar button before Issues and a command-palette action. Shown for every
  project that is not archived or a scratch one. The sort and filters live in the URL (`branchSort`, `merge`, `kind`,
  `remote`).
- **Android**: a Branches tab before Issues (a page like Issues and Releases; the row's "Open thread" opens it). The tab bar
  holds four tabs, so with Pulls hidden Usage moves under the overflow entry. Search, sort and filter chips (merge state,
  kind, remote) and a project chip share their logic with the web (`filterBranches`, `sortBranches`).
- No data migration.

## File operations (change 39)

The Files panel only read. Now a row's menu (right-click on the web, long-press on Android) and the empty area of the tree
offer New file, New folder, Rename, Move to..., Copy to... and Delete; Android also has a "+" menu in the header.

- **Server**: one RPC, `projects.modifyEntry` (`AuthFilesystemWriteScope`, also in `CLIENT_GUARDED_RPC_SCOPES`), a method on
  `WorkspaceFileSystem`. The operation is a tagged union (`create` file or folder, `move`, `copy`, `delete`); a rename is a
  move that keeps the parent. It goes through the same path resolution as `projects.writeFile`, so it stays inside the
  workspace and out of `.git` folders. The entry itself is not followed when it is a symlink: deleting a link removes the
  link, and a copy keeps links as links.
- **Never overwrites**: a taken destination fails with `already_exists`, a folder into itself with `invalid_target`, a
  vanished source with `not_found`. Moves use `rename`, so they stay in one filesystem.
- **Clients**: names are checked with `entryNameError` (`packages/client-runtime/src/fileEntryPaths.ts`), delete asks for
  confirmation, and move/copy pick a destination folder in a dialog (breadcrumb, sub-folders, "Move here"/"Copy here").
  The listing is refreshed after each operation. The menu items hide without the write permission and for host folders
  (absolute paths outside a project).
- **Not built**: agents get no MCP tool (they have their own file tools), no undo or trash, no drag and drop, no
  overwrite-on-conflict, no multi-select.
- No data migration: nothing persisted changed.

## GitHub Releases (change 36)

Issues' sibling for the project's GitHub releases: what shipped, its notes and downloadable assets, without leaving T3.
Read-only; nothing writes (no create, edit or publish).

- **Reads** go through GitHub's REST API: `repos/o/r/releases` (30 per page, "Load more") for the list and
  `repos/o/r/releases/{id}` for the detail. The detail is keyed by id because `releases/tags/…` omits drafts. Drafts
  show only when the token can push. "Latest" marks the newest release that is neither a draft nor a pre-release.
- **No new service.** `listReleases` and `getRelease` are two more methods on `IssueProviderApi`, served by
  `IssueService` (the project → repository resolution, the error mapping and the `IssueError` reasons are the same).
  Contract `packages/contracts/src/release.ts`, RPCs `releases.list` and `releases.read` (read scope). Other forges have
  no `issues` and answer "unsupported".
- **Web**: page `/releases` (project picker when several projects are on GitHub, list next to the release, Markdown
  notes, asset list with size and download count, "Open on GitHub"), a sidebar button and a command-palette action, both
  shown only when a project is on GitHub. The right panel has a "Releases" tab (key `R`), offered when the thread's
  project is on GitHub. Components in `apps/web/src/components/releases/`; the queries sit with the issue ones
  (`issueEnvironment.releaseList` / `releaseDetail`).
- **Android**: a Releases tab after Issues (a page that swaps between the list and a release; the notes use the pull
  request Markdown view, assets open in the browser). Settings → Navigation lists it like the other tabs; it shows by
  default, so with Pulls hidden the four phone tabs are Threads, Issues, Releases and Usage.
- No data migration.

## Android catch-up (change 35)

Web-only changes the Android app lacked. What does not qualify stays web: the breadcrumb switchers, the right-panel Issues
tab (Android has an Issues tab), the changed-files card (Android has none), the Thread actions section (Android has no
thread details card) and the action editor.

- **Git logic is shared.** `buildMenuItems`, `resolveQuickAction`, `getGitActionDisabledReason`, `formatQuickActionLabel`
  live in `packages/client-runtime/src/state/gitActions.ts` and carry the fork's merge, force push
  and "ahead of the default branch" rules, so the web copies in `GitActionsControl.logic.ts` only re-export what moved.
- **Git sheet and menu.** Merge, Merge & push and Force push rows; the quick action follows the project's main Git action
  (`quickMergeAction`, Settings → Source control); force push lists the commits it deletes and sends in a
  confirmation.
- **Branches.** A branch checked out in another worktree, the project checkout included, moves the thread there instead of
  being disabled, as on web (`useSelectedThreadGitActions.onUseSelectedThreadWorktree`).
- **Move to new worktree** is in the thread row's menu for an idle thread in the project checkout, like web's thread menu.
  Not in the Branches sheet, which has its own New worktree form.
- **Tints.** Input, Done and draft rows tint on Android with the web's colors and light/dark strengths
  (`thread-list-v2-row-tint.ts`); an unsent composer draft shows "Draft". iOS is not tinted: this fork builds Android only.
- **Confirm pushing to the default branch** is a device preference on Android (web keeps it in the browser): Settings →
  Source control → This device.
- No data migration: one new optional key, `confirmPushToDefaultBranch`, in the Android preferences (absent means on).

## Other ways to run the Android emulator (change 40)

An investigation; nothing is built. Today the Device panel runs the Android Emulator from the SDK through upstream's
`expo-device-hub` (`serve-emu`) and drives it with `agent-device` (`docs/internals/devices.md`). It works on a headless
host, and the panel already has fold controls (`/api/fold`, `DeviceAndroidFoldControls`). The question is whether another
way to run an emulator beats it on a server, in the host install and in Docker.

**Requirements.** A candidate that fails either is out:

1. **A Google Play image.** The Play Store opens, signs in and installs, and Play Integrity passes enough for the apps
   under test. An AOSP image does not count.
2. **Foldable support.** Fold and unfold at runtime (posture and hinge angle), the inner display resizing, and apps
   receiving the fold state (Jetpack WindowManager), driven from the panel and by agents.

**Baseline to beat.** The SDK emulator with a Play Store foldable AVD (a foldable device definition with a
`google_apis_playstore` image), through the hub as now. First check that it meets both requirements on this host;
if it does not, say where it fails. A physical foldable phone over adb meets both by construction (the hub already brings
scrcpy for physical phones), so it is the fallback when no emulator does.

**Cuttlefish.** Google's virtual device for Linux servers: headless, adjustable form factor, a WebRTC streamer, and a
foldable target (`cf_x86_64_foldable`, seen in a 2021 commit of `device/google/cuttlefish`; check that it still exists and
what it does). Unverified, and the likely blocker: Cuttlefish is built from AOSP, which ships without Google Play
services, and nothing found says a public Play image exists. Check this first; if there is none, stop here. If there
is one, check:

- KVM and kernel needs on the host and in a container, and the cost beside the SDK emulator (boot time, idle CPU and RAM).
- How the panel would reach it: `serve-emu`'s WebRTC path (used for EAS Simulator) already exists in the client; a host that
  speaks the `serve-emu` protocol needs almost no client change (see change 1, which uses the same seam).

**scrcpy.** A mirror and controller, not an emulator: it runs on top of any adb device, so it would replace the stream and
input path, not the emulator, and Play and foldable support still come from whatever it mirrors. Things to find out: what
it adds over `serve-emu` for an emulator (latency, audio, clipboard, hardware keyboard, its virtual display), whether a
browser client can decode it (`ws-scrcpy` and `@yume-chan/scrcpy-decoder-webcodecs` use WebCodecs, so the secure-context
limit stays), and how the fold posture is set, since that still comes from the emulator.

**Docker.** The release image has no Android SDK, and a container has no `/dev/kvm` unless it is passed in. Find out what a derived image needs to run an emulator
and what that costs, for each candidate.

**Method.** Per candidate: the two requirements first, as a pass or fail with the evidence. Then, on this host, boot time,
idle CPU and RAM, and the panel's frame latency over HTTPS (Tailscale). Only a candidate that beats the baseline on a
named measure gets a `DeviceHost` adapter, built as in change 1: platform stays `android`, `upstream` names the backend,
the proxy allowlist grows by its paths. Record the outcome here and drop what failed. A new setup step or consent screen
would need docs under `docs/operations`; no data migration and no changelog line until something ships.

Sources: [Cuttlefish](https://source.android.com/docs/devices/cuttlefish), [ws-scrcpy](https://github.com/maxduke/ws-scrcpy),
[Tango's scrcpy WebCodecs decoder](https://docs.tangoapp.dev/scrcpy/video/web-codecs).

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

**Sync procedure** (by hand; see "Daily sync (change 6, dropped)")

1. `git fetch upstream`, then `git log --oneline HEAD..upstream/main` to see what is coming.
2. `git rebase upstream/main`. `git config rerere.enabled true` is set, so a conflict is resolved once and replayed on
   every later rebase. Resolve in the commit it appears in (`git rebase --continue`), not in a trailing fix commit.
3. Verify what the stack touches: `vp run check:changed` and the tests next to the patches, plus a dev-client pass for
   anything visible. A patch that upstream now covers is dropped from the stack and its row here is removed.
4. Force-push `origin main` with `--force-with-lease` pinned to the `origin/main` the rebase started from.
5. Disable any workflow the rebase added that is not `ae-*`, then start `ae-release.yml`.

**Keeping conflicts small**

- **Additive over edited:** new code in new files with tests next to them. Edits to existing files stay at the touch
  points described in each change, a few lines each: no reformatting, no renames, no drive-by fixes.
- **Upstream identifiers stay** (env vars, package and file names); only values change (see the Identity section).
- **Off by default:** a feature nothing enables fails soft when a rebase drops a piece of it.
- **Upstream stays an option:** if the maintainers ever ask for it, the additive layout makes a branch a clean PR;
  until then nothing is offered.

## Current branch action (change 42)

The Git button of a thread's branch offered "Push & create PR" whenever the branch was ahead and had no pull request. A
project-scoped setting `currentBranchAction` (`push` by default, or `pull_request` for the old behavior; Settings → Source
control, above the default branch action) picks the main action.

- `resolveQuickAction` (`packages/client-runtime/src/state/gitActions.ts`, and the web copy in `GitActionsControl.logic.ts`)
  takes a `createPr` flag. Off, it never runs `create_pr` / `commit_push_pr`: a dirty branch commits and pushes, an ahead one
  pushes, and a pushed one with no pull request has no main action (Create PR stays in the menu).
- Web, desktop and Android follow it (Android: Settings → Source control → "Current branch action").
- No data migration: a new setting with a default. Servers without it ignore the key; older clients show their old button.
