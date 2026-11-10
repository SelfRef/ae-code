# Changelog

What changed in AE Code since upstream's T3 Code, release by release. Upstream's own changes are
listed in its releases; each AE Code release links the upstream commits it picked up.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are named
by date (`vYYYY.MM.DD`, `.1`, `.2` for later ones the same day).

## [Unreleased]

### Added

- Skills: Settings has a skills manager that lists every provider's skills in one place and keeps a
  shared library with a switch per provider. A provider's skills can be imported into the library,
  Claude then uses only the library's, and agents manage skills themselves through T3's tools.
- A thread that has already started can be moved into a new worktree, from the workspace control or
  the thread menu (the control used to lock after the first message).
- The Git actions menu merges a thread's branch into the default branch, with or without pushing;
  it can also be a project's main action.
- Issues open in the right panel.
- Sidebar: Done and Input threads are tinted, a draft shows a Draft status, and a thread without a
  worktree shows a branch icon before its branch name.
- A plain `ae-code serve`, not only the Docker image, updates in place from GitHub releases when
  `T3CODE_SELF_UPDATE=true`, and the server archive ships a systemd unit.
- The AUR packages are updated on every release.

### Changed

- New worktrees default to semantic branch names and start from the local branch, not the remote.
  Merged, deleted, unchanged and settled (for 3 days) worktrees are cleaned up.
- Appearance defaults: Dev artwork, 100 ms panel animations, composer context on, and a version in
  the sidebar header. The Nightly artwork is gone.
- One icon, the blueprint tile with the Aperte glyph, on every platform and build.
- The desktop app's update dialog says why it cannot update itself.

### Fixed

- Linux: opening AE Code from a pinned dock icon uses that icon instead of adding a second one (the
  launcher now names the window class the app really uses).
- Compact counts and token numbers follow the browser's locale.
- Rows in the browser's empty state can be clicked.
- Providers installed from a Linux distribution's package stay manual-only: AE Code no longer
  offers to install or update them itself.
