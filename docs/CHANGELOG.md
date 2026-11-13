# Changelog

What changed in AE Code since upstream's T3 Code, release by release. Upstream's own changes are
listed in its releases; each AE Code release links the upstream commits it picked up.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are named
by date (`vYYYY.MM.DD`, `.1`, `.2` for later ones the same day).

## [Unreleased]

- Android: with "Settle after merge" on, the ship button's Merge also closes the thread's screen once it is settled.
- Android: the ship button no longer flashes Merge again after a merge before turning into Settle; it keeps its spinner until the status has refreshed.
- Android: an expanded tool call or command row now indents its details under the row label, with a little vertical padding.
- Android: Settings → Providers no longer lists providers that are not installed on the environment.
- Usage → Limits (web and Android) lists the provider with the least remaining quota first.
- Android: the "Settled thread" undo notice on the thread list now sits above the New thread button instead of covering it.
- Android: the full-screen device preview keeps the status bar visible instead of hiding it.

## [v2026.11.13.7] - 2026-11-13

- Android: the floating **Settle** button no longer jumps up when the scroll-to-end button shows, and settling a thread with it closes the thread. The button has a colour per step (Commit blue, Merge violet, Settle green) and shows a spinner and ignores presses while its step runs.

## [v2026.11.13.6] - 2026-11-13

### Fixed

- The Android APKs of a release are attached again after the faster build skipped lint in a way Gradle rejected.

## [v2026.11.13.5] - 2026-11-13

### Fixed

- A failed Android build in the release workflow prints Gradle's error in the job log (the live log dropped it).

## [v2026.11.13.4] - 2026-11-13

### Changed

- Releases build the Android APKs faster: the native libraries are cached between releases and the APKs build beside the other jobs.

## [v2026.11.13.3] - 2026-11-13

### Added

- A push that the remote rejects (it moved on, for example after a release commit) is handed to the thread's agent, like a failed merge: **Push**, **Push n commits** and the Commit & push actions now fall back to it. The agent commits pending work, rebases onto the remote keeping every change and pushes again, with no force-push. The Merge by agent setting covers it and can still turn it off.
- The thread details card shows, under the branch picker, whether the branch is up to date with the default branch. When it is behind, an amber row ("3 commits behind main") has an **Update** button that rebases the branch onto it.
- Devices (web and Android): every device has an **Input** choice, **View only** or **Take control** (the pointer button in the web toolbar, the **Input** group in the Android device menu). View only keeps the screen live but drops your own touches, keys and buttons, so you can watch an agent without nudging the device; a device an agent opened starts in View only. It does not stop the agent. Needs a new app build on Android.
- Android: the terminal button in the thread bar shows a count of terminals with a task running (idle shells are not counted).
- Android: the composer's **+** button opens a drawer with your recent photos and **Gallery** and **File** buttons, instead of a two-item menu. Tap photos to select several, then **Attach**. The photos need the photo permission, asked only when you tap **Show recent photos**; without it, the buttons still work. Needs a new app build.
- Android threads show a floating button at the bottom right that does the next step of working in a worktree: **Commit** with uncommitted changes, **Merge** once they are committed but not in the default branch, **Settle** once merged. It hides while the agent works and when the thread had no changes. Turn it off under Settings → Source control → This device.
- The usage limits move out of the thread details card into a card of their own under it. The first card keeps its scroll and drops to a smaller density to leave room for it.
- The thread details card labels its Current branch, Default branch and usage (for example Claude usage) sections, and each usage limit shows the time left until it resets (`2d 4h`, `3h 20m`). The branch picker shows a worktree icon for a thread in a worktree. The Thread actions section moves below Default branch and now holds the Context row too, with no divider between them. The Settle thread button is dimmed and says "Not all changes merged into main" until the thread's changes are merged into the default branch; Settle thread then leads the arrow menu, and only appears there while the button cannot settle.
- Android: the navigation rail's sidebar button moves from the bottom to the top, replacing the menu button, and keeps the sidebar icon whether the sidebar is shown or hidden; the new thread button moves to the bottom. Without a sidebar to toggle, the menu button stays.
- Branches (page, right-panel tab and Android): a worktree branch with commits the default branch lacks has a **Merge** button that fast-forwards the default branch to it (committing the worktree's uncommitted changes first, rebasing the branch if the default moved; nothing is pushed), after a confirmation. On Android the history, merge and delete buttons are icons on the right of the row, and on a narrow screen they collapse into one menu button that a long press on the row also opens.

### Fixed

- Android: a git action from the thread header (merge back to source, commit, push, pull request) keeps its progress banner until the result replaces it, instead of hiding for the seconds the app spent refreshing the branch.
- Thread list (Android): a thread waiting on another thread now shows how long it has been running, like a working one, instead of a bare icon.
- Android: the thread header's git menu icon for a worktree is a folder with a branch badge, the same as "New worktree", instead of a fork that looked like the branch icon.

## [v2026.11.13.2] - 2026-11-13

### Added

- Thread list (web and Android): when only snoozed or settled threads are left, the list says **No active threads** instead of leaving the space above the shelves empty.
- Android: a draft chat has a terminal button in its header, opening a shell in the draft's workspace.
- Work log (web and Android): the memory tools (recall, save, forget) get their own bookmark icon instead of the AE glyph, which stays the fallback for other T3 tools.

### Fixed

- Android: the swipe from the list to the last chat did nothing, because the rows' own swipe took the gesture; the screen now also follows your finger and slides away instead of switching on release. An open row closes by tap, no longer by a swipe to the right.
- Release: the Windows installer job always failed on a check that could not pass, so no release carried the Windows assets.

## [v2026.11.13.1] - 2026-11-13

### Fixed

- Check for updates (mobile and `ae-code update`) offered no new release: it compared a release's date tag, such as `v2026.11.13`, with the installed `2026.1111.2` as plain numbers and found the installed version newer.

## [v2026.11.13] - 2026-11-13

### Added

- Android: the git menu in a thread's header lists **Rebase onto the default branch** while the branch is behind it, and the Default branch row says so, so a big "Merge N commits" count after the default branch moved no longer looks like N new commits.
- Issues (web and Android): **Work on this** in an issue opens a new thread with the issue (description and comments) attached to the composer, and typing `#` in the chat composer now offers the project's issues next to its pull requests.
- Device panel: the GNOME desktop starts `gnome-keyring-daemon` (when installed) so apps on it have a secrets provider to save logins in.
- Agents get tools for pull requests and issues of a project's repository (all through your signed-in host account): `list_pull_requests`, `read_pull_request` (with comments, reviews and review threads), `comment_on_pull_request` (also replies to and resolves review threads), `review_pull_request`, `update_pull_request` (title, description, labels, reviewers), `act_on_pull_request` (merge, close, reopen, ready, draft, update or delete the branch, auto-merge, revert, approve workflows), `list_issues`, `read_issue`, `create_issue` and `update_issue` (title, body, state, labels, assignees, comment).
- Android: the git button in a thread's header shows a worktree (fork) icon instead of the branch icon when the thread runs in a worktree.
- Commit history: every branch row in Branches has a history button that opens the branch's commits as a list or a graph (lanes for merges, like VS Code), with a branch picker (or all branches) and, per commit, its message and changed files. On the web it is a **Commits** page (sidebar, command palette) and right-panel tab; on Android it opens from the Branches row.
- Branches: the **Open thread** button on a row shrinks to its icon when the list is narrow.
- The hover popup of a sidebar thread now starts with its status (Working, Waiting, Approval, Done, Settled, Idle, ...).
- Settings → Environments on the web now lists the server the page is served from as its first row, as the desktop app already did, so it no longer looks like there is only one environment.
- Branches (page, right-panel tab and Android): **Delete merged (n)** removes the local branches the default branch already contains, after listing them for confirmation. Checked-out branches, worktree branches and remote copies are left alone.
- Branches (page, right-panel tab and Android): every plain local branch row has a delete button, so one branch can be removed on its own, merged or not (an unmerged one asks first and says its commits are lost). The default, checked-out and worktree branches and remote copies stay.
- The Default branch section lists **Rebase onto the default branch** while the default branch has commits the thread's branch lacks, so a long-running thread can catch up (and meet conflicts) before it merges.
- Agents get a `t3_worktree_merge` tool that lands their thread's branch on the default branch (optionally pushing it), the same as the Default branch button, so they can finish their own work when you ask them to merge.
- Settings → Source control → **Settle thread after merge** (off by default, web and Android): a merge from a thread's Default branch button settles the thread.
- A thread whose branch was merged into the default branch shows the merged icon in the sidebar when it has no pull request, and its Merge button reads **Merged** until the branch gets new commits.
- Actions: a **Run before the thread merges into the default branch** switch (and `"runBeforeMerge"` in `t3.json`) runs an action, such as your tests, after the merge's rebase and before it lands; a failure stops the merge and hands it to the agent.
- Settings → Source control → Merge strategy: **Squash into one commit** makes a merge into the default branch land a branch of several commits as one commit with a generated message (web, desktop and Android). The default keeps the commits.
- Settings → Voice → Input: a switch hides the microphone button in the message box. The dictation shortcut still works.
- Releases now include a Windows x64 server (`ae-code-windows-x64.zip`) and desktop installer (`AE-Code-<version>-x64.exe`). The Windows desktop app updates itself from the releases (Settings → About, or the update button). Both are unsigned and not yet tested on a real Windows machine.
- Android: on a phone-sized screen, swipe right anywhere in a chat to slide it away and return to the list, and left anywhere in the list to reopen the last chat; thread rows reveal their actions on a right swipe (no longer only from the screen edge).
- Android: long-press the New thread button for a menu of your most recent projects (with icons) to start a thread in one, or to choose another project.
- Android: on a wide screen, the sidebar button moved from the top bar to the bottom of the navigation rail.
- Android: on a wide screen (tablet, unfolded), a device or browser button in the thread's top bar, beside Files and Git, opens the preview next to the chat instead of over the whole screen. Its Maximize button takes it full screen, and the sidebar's expand button gives the chat the room instead.
- Synced drafts: unsent text, model and mode picks, and new-thread drafts (project, branch, worktree) follow you between web, desktop and the Android app on the same server. The device you are typing on wins; attachments and context chips stay on the device that added them. Needs the server updated too.
- Settings → General → Confirmations: choose when closing a terminal asks first (never, only while a command is running, or always). The default asks only while a command is running, not at an idle shell.

### Changed

- Releases no longer wait for the Windows build: the release is published once the Linux archives are built, and the Windows server and installer are attached when they are ready.
- The executable and command are now `ae-code` (was `t3`): `ae-code serve`, `ae-code up`, the `ae-code` link the desktop app creates, and every hint in the app and the CLI. The npm package stays `t3`.
- Environment variables can use the `AECODE_` prefix (`AECODE_HOME`, `AECODE_PORT`, `AECODE_SELF_UPDATE`, ...). `T3CODE_` names keep working as the fallback, and `AECODE_` wins when both are set, so nothing needs changing. Build-time variables still use `T3CODE_`.
- Settings → Environments: each environment checks its own server for a newer GitHub release instead of comparing with this app's version, so a local build here no longer offers or hides updates. The update icon is larger.
- Chat breadcrumb: picking a project in the project switcher starts a new thread in it instead of opening its newest thread.
- The small preview player no longer shows the browser control switch (view only, take control, share control); it stays in the full preview.

### Fixed

- A run that failed with a provider error (a Cloudflare 403, a dropped connection, ...) can now be retried on the web and Android: the composer's Resume button appears for it, as it already did for interrupted runs and usage limits, instead of leaving only a retyped message.
- A thread branch that was already pushed no longer ends up diverged from its upstream after a merge into the default branch rebases it: the merge updates the upstream to match (only if nobody pushed to it meanwhile).
- Merging several threads of one project into the default branch at the same time no longer fails for the slower ones: the merges now run one after another, and a merge rebases once more if the default branch moved meanwhile.
- Merging into the default branch no longer fails because you have uncommitted edits in that branch's checkout: only edits to files the merge changes, or untracked files in its way, stop it.
- Worktree cleanup now removes a worktree whose branch was merged into the local default branch even before that branch is pushed, like the Branches page already counted it.
- A thread that is open in the web app when its snooze ends no longer shows as Woke on your other devices (mobile already did this).
- Closing the last tab in the side panel keeps the panel open on the tab picker instead of hiding it.
- The Android app's version name is now the release tag (2026.11.12) instead of the semver form (2026.1112.0), so Obtainium
  compares it correctly with the latest release instead of treating the installed build as newer. Install the next
  release over the old one once (Obtainium offers it as a downgrade).

## [v2026.11.11.2] - 2026-11-11

### Changed

- Rebased on the latest upstream T3 Code. The Diff panel now keeps its selection when you leave a thread and come
  back, like upstream, instead of resetting each time it opens; a thread you have not picked a scope for still starts
  on Uncommitted.
- A thread whose worktree storage cleanup removed shows "New worktree on next message" in its details instead of
  **Initialize Git**; the next message recreates the worktree.

## [v2026.11.11.1] - 2026-11-11

### Added

- Device panel: a **GNOME desktop** on Linux servers with GNOME Shell, next to Android emulators. It is a headless GNOME
  Shell session with its own settings and extensions, for testing GTK apps and Shell extensions; you and agents see
  and drive the same screen (click, right-click, scroll, type, paste) from web, desktop and Android. The stream is
  H.264, encoded on the GPU where VA-API is available. It runs in a container without a display or a logged-in user;
  the packages it needs are listed in the [devices guide](./user/devices.md#gnome-desktops).
- Branches open in the right panel (add menu, key `G`), with the page's search, sort and filters.

- Browser: a three-way **View only / Take control / Share control** selector on web and Android. Share control lets you
  click and type in an agent's tab while the agent keeps working: both actions run in one order and nothing the agent
  queued is cancelled. Take control still locks the agent out until you release it.

### Changed

- Device panel (web): the controls are a row above the screen, like the browser's, instead of a column at the right
  edge. Fold and Duo controls sit in the same row.

### Fixed

- The desktop app, the web app (favicon, installed app) and the iOS icon show the blueprint tile with its grid, like the
  Android app, instead of a flat dark tile.
- Linux: the app also installs its icon as an SVG, so docks and launchers scale it at any size.

## [v2026.11.11] - 2026-11-11

### Added

- Branches, Issues and Releases (web): the title row is the thread header's project switcher followed by the page name, and it
  clears the sidebar toggle when the sidebar is hidden. The pages open on the project of the chat you opened last.
- Branches and Issues (web): Sort and Filters menus and a refresh button that spins while it reloads, like Pull requests.
  Branches filters by merge state, kind and remote and searches by name; Issues sorts by update, creation or comments
  and filters by state and "created by me" / "assigned to me".

- Android: Issues and Releases show the open item beside the list when the page is wide (unfolded, tablet) and one at a
  time otherwise. Branches, Issues and Releases open on the last chat's project, choose it from a chip, and Branches and
  Issues get the same sort and filters as the web.

### Changed

- The Git button of a branch pushes by default instead of pushing and creating a pull request (and commits and pushes
  instead of commits, pushes and creates one). **Settings → Source control → Current branch action**, globally or per
  project, brings the pull request back as the main action; **Create PR** stays in the menu either way.
- Merging into the default branch moved out of the Git actions menu into its own **Default branch** section of the thread
  details card (off by default; turn it on from the card's show/hide list). Its button merges the branch, with
  **Merge & push** and **Push n commits** (the default branch as it is) under the arrow; with nothing to merge, the push is
  the button. Android: the Git menu and sheet list the same actions under "Default branch". The project setting now only
  picks between Merge and Merge & push as the main action.
- Branches lists the primary remote's branches by default; a fork's `upstream`, with thousands of branches, no longer fills the
  200-branch list. The Filters menu picks another remote or all of them (Android follows the default too).

### Fixed

- Default branch menu: against a server that predates the push of the default branch, **Push** is no longer listed as a disabled "nothing to push" (the server does not count those commits); update the server to get it.
- A Git action's progress shows only in the thread details section (Git or Default branch) that started it, not in both.
- Merging into the default branch by the agent no longer hangs: the agent's turn waited for the checkout that the merge held while waiting for that turn. The merge, Merge & push and the agent's turn now share the checkout in turn.
- Merging by the agent with a model chosen for it no longer leaves the thread on that model: the thread's own model is put back when the turn ends.
- Forgejo / Gitea: a `GITEA_TOKEN` in the server's environment without an instance no longer hides the signed-in `gt` account (the provider read as not authenticated).
- Updating a Docker or bare-host server from another app (sidebar, banner) installs the newest GitHub release even when
  the app's own version is a local build that is no release.

## [v2026.11.10.4] - 2026-11-10

### Added

- Docker image: carries the `gh`, `glab`, `fj` and `gt` source-control CLIs. The README now describes the image as a base to
  extend and shows a derived image with toolchains and agent CLIs.
- Files panel (web and Android): create files and folders, rename, move, copy and delete from a row's menu or the
  empty area of the tree (right-click on the web, long-press or the "+" menu on Android). Needs the write permission.
- Issues and Releases hide while GitHub isn't signed in on any connected environment, and Pull requests while no
  source-control provider is (sidebar, command palette, Android tabs). Settings → Navigation tabs marks them "Not signed in".
- Android: Input, Done and draft threads are tinted in the list, and an unsent draft reads "Draft".
- Android: the Git sheet and menu merge into the default branch and force push (listing what it deletes); the
  main Git action follows the project's setting. Their headers count a feature branch's "ahead" commits against
  the default branch, not its upstream.
- Android: choosing a branch checked out in another worktree, such as `main`, moves the thread there.
- Android: a started thread can be moved into a new worktree from its menu.
- Android: Settings → Source control sets the main Git action and whether pushing to the default branch asks first.
- Android: on wide screens, drag the edge of the sessions pane to resize it; the width is remembered.
- Android: on a phone-sized screen, swipe in from the left edge of a chat to return to the list, and in
  from the right edge of the list to reopen the last chat.
- Android: on a wide screen (an unfolded foldable), sheets open as a centered card instead of a bottom sheet
  stuck to the left edge.
- Actions: the Command field lists the variables a command can use (`T3CODE_PROJECT_ROOT`,
  `T3CODE_WORKTREE_PATH`).
- Saved environments are shared between browsers: the environments you add in one browser signed in to a
  server show in every other browser signed in to it (the browser needs the `access:write` permission there).
- Source control: the Commit action names how many files it commits, next to the Push action's commit
  count, in the quick button and the menu. The Merge action names its commits too, and the quick button
  stays locked as "Merge" while there is nothing to merge.
- Skills: Settings has a skills manager that lists every provider's skills in one place and keeps a
  shared library with a switch per provider. A provider's skills can be imported into the library,
  Claude then uses only the library's, and agents manage skills themselves through T3's tools.
- A thread that has already started can be moved into a new worktree, from the workspace control or
  the thread menu (the control used to lock after the first message).
- The Git actions menu merges a thread's branch into the default branch, with or without pushing;
  it can also be a project's main action.
- The thread details card ends with a Thread actions section: Settle thread, and an arrow with the thread's
  context menu. It can be hidden like the card's other rows.
- When a merge fails, for example on a rebase conflict, the thread's agent takes over on its own: the Merge
  action stays in progress ("Merging by agent...") while the agent rebases, resolves the conflicts and finishes
  the merge, and the thread shows a system notice instead of a message.
  Settings → Source control turns this off and can pick a different model for it; the section's Advanced group is
  now a flat list.
- Branches: a page (sidebar, command palette) and an Android tab list a project's branches and worktrees
  with what each has to push, pull and merge, highlight the ones with commits the default branch lacks and
  link to the thread working on them.
- Issues open in the right panel.
- Releases: a project on GitHub lists its releases with their notes and assets, on a Releases page
  (sidebar, command palette), in the right panel and in a Releases tab in the Android app.
- Sidebar: Done and Input threads are tinted, a draft shows a Draft status, and a thread without a
  worktree shows a branch icon before its branch name.
- A plain `ae-code serve`, not only the Docker image, updates in place from GitHub releases when
  `T3CODE_SELF_UPDATE=true`, and the server archive ships a systemd unit.
- The AUR packages are updated on every release.

### Changed

- The thread details card is wider (320 px instead of 280 px), so long branch names, change counts and the Uncommitted row fit without truncating.
- The floating browser and device preview shows its buttons (open in the right panel, pop out, close) in its top-right corner while the pointer is over it, instead of behind a small dot; on a touch screen they are always shown.
- Forgejo and Gitea use Gitea's new `gt` CLI (1.0 or later, Gitea 28 or later) instead of `tea`. Sign in again with `gt auth login`; `fj` is still preferred when it has a login for the server.
- The Uncommitted row in the Git panel names how many files changed, beside the added and removed line totals.
- The Git actions menu uses short labels (Commit & merge, Merge & push) and grows wider than the panel when a label needs it, instead of cutting it off.
- The main Git action defaults to merging into the default branch (it was opening a pull request), and the setting lists the pull request option last. A choice you already made is kept.
- Settings text says Æ Code instead of T3 Code, and uses generic wording where it named the upstream server, process or home folder. T3 Connect and T3 Chat keep their names, since they are upstream services.
- Surfaces: the "Open a surface" menu and the add-tab menu list Files, Diff, Terminal, Issues, Pull
  Request(s), Browser, Device and Side Chat, in that order and in title case.
- New worktrees default to semantic branch names and start from the local branch, not the remote.
  Merged, deleted, unchanged and settled (for 3 days) worktrees are cleaned up.
- Appearance defaults: Dev artwork, 100 ms panel animations, composer context on, and a version in
  the sidebar header. The Nightly artwork is gone.
- One icon, the blueprint tile with the Aperte glyph, on every platform and build.
- The desktop app's update dialog says why it cannot update itself.

### Fixed

- Git status stays current: opening a thread rereads it, a git action that fails refreshes it too, and a feature branch already merged into the local default branch no longer offers "Merge N commits" again.
- Android: pushing from the default branch on a new-thread draft asks to confirm instead of refusing with "Choose a feature branch".
- Android: Settings → Source control shows the "Confirm pushing to the default branch" switch while a project is selected too.
- Done, Input and draft chats in the sidebar have a more visible tint on the dark theme.
- The Session and Weekly usage bars are as bright as the Context bar on the dark theme.
- Editing a queued message holds the queue until you save or cancel, so the message no longer starts
  mid-edit when the turn ends, and the steer shortcut leaves it alone.
- Linux: opening AE Code from a pinned dock icon uses that icon instead of adding a second one (the
  launcher now names the window class the app really uses).
- Compact counts and token numbers follow the browser's locale.
- Rows in the browser's empty state can be clicked.
- Providers installed from a Linux distribution's package stay manual-only: AE Code no longer
  offers to install or update them itself.
