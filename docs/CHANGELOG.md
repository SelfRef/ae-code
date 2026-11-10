# Changelog

What changed in AE Code since upstream's T3 Code, release by release. Upstream's own changes are
listed in its releases; each AE Code release links the upstream commits it picked up.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are named
by date (`vYYYY.MM.DD`, `.1`, `.2` for later ones the same day).

## [Unreleased]

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
