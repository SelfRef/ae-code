# AE Code

AE Code is a personal fork of [T3 Code](https://github.com/pingdotgg/t3code), a minimal GUI that controls the coding agents on your machine (Claude Code, Codex, Cursor, Grok Build, OpenCode, Google Antigravity, Kiro and more) from a web app, a desktop app and a mobile app. It keeps upstream's architecture and providers and adds the features listed below.

The fork is kept as a linear stack of patch commits on top of upstream's `main`, rebased daily. Everything not listed here behaves as in T3 Code. The [roadmap](./docs/ROADMAP.md) lists what is done and what is planned, with the reasoning behind each change; other forks of T3 Code and what they offer are in [docs/FORK_REFERENCES.md](./docs/FORK_REFERENCES.md).

## What the fork adds

### Agents and providers

- **Memory.** Preferences, decisions and facts that agents on any provider can recall, save and forget through MCP tools, with a Settings page to review and edit them. Claude sessions start with the saved memories, and Claude's own memories can be imported. ([guide](./docs/user/memory.md))
- **MCP servers from Settings.** One list of stdio and HTTP MCP servers that applies to Claude, OpenCode, Antigravity and Codex sessions. ([guide](./docs/user/mcp-servers.md))
- **Install agent CLIs from Settings.** Install Claude Code and OpenCode into `~/.local` with npm, and update them there, without leaving the app.
- **Remove a built-in provider.** Hide Codex, Claude or any other provider you do not use; _Add provider_ brings it back.
- **Streaming Claude replies.** Claude's reply text streams while it is written instead of appearing at the end of the turn.
- **Claude usage limits with a setup token.** The usage bars fill from Claude's rate-limit events for sessions signed in with a setup token, where the usage query is not available.
- **Stop a stuck steer.** A steer waiting behind a long-running command gets _Stop it and send now_.

### Interface

- **Project and thread switchers in the chat breadcrumb.** Jump to another project or thread without going back to the sidebar.
- **Running subagents in the sidebar.** A thread whose turn ended while subagents still work reads "N subagents" instead of a stalled "Waiting".
- **Thread details defaults.** Usage limits and Context window are shown by default; Open in editor is shown by default only on desktop.

### Privacy

- **No product analytics.** The server sends no usage events unless `T3CODE_TELEMETRY_ENABLED=true`.

### Running and releasing

- **Its own identity.** App id `dev.aperte.AECode`, state in `~/.ae`, Electron profile `ae-code`: it runs next to upstream's T3 Code without sharing data. Data written by T3 Code is not read; see "Data migration" in [ROADMAP.md](./docs/ROADMAP.md).
- **Android app.** Package `dev.aperte.aecode`, built and signed by the release workflow and attached to each release as an APK.
- **Docker image.** The release server on GHCR, `ghcr.io/selfref/ae-code`.
- **Date-versioned releases.** `vYYYY.MM.DD` releases with the Linux x64 server archive, published when `main` has new changes.

## Install

Only the Linux x64 server and the Android app are built. There is no desktop installer, no iOS app and no `npx` launcher, so the desktop app's updater finds nothing. Install and sign in to at least one agent CLI on the machine that runs the server (Claude Code, Codex, Cursor, OpenCode and so on), or install Claude Code and OpenCode from Settings → Providers after the first start.

### Dependencies on Arch Linux

What the server calls on the host depends on the features you use.

Required:

```bash
sudo pacman -S git openssh
```

`git` backs checkpoints and worktrees, and `openssh` is for cloning and pushing over SSH. You also need at least one agent CLI, as described above.

For the Browser panel and HTML renders, which download a headless Chrome on first use, Chrome's shared libraries and fonts must be installed. `t3 browser setup` only knows apt, so on Arch install them yourself:

```bash
sudo pacman -S --needed nss at-spi2-core libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa libxkbcommon alsa-lib fontconfig ttf-liberation
```

Without them the browser tab reports missing libraries, and without fonts pages render with no text. Chrome's sandbox needs unprivileged user namespaces (on by default in the `linux` and `linux-lts` kernels, off in `linux-hardened`) and cannot start as root. Set `T3CODE_SERVER_BROWSER_SANDBOX=0` in the server's environment to run without it.

Optional:

- `nodejs npm`: install Claude Code and OpenCode from Settings → Providers.
- `lsof`: list local server ports in the Browser panel.
- `xdg-utils`: open files and folders in your desktop apps.
- `github-cli`: GitHub pull requests and issues (`gh auth login`).
- `glab`, `forgejo-cli` or `tea`: GitLab, Forgejo and Gitea.
- `tailscale`: remote access with `t3 serve --tailscale-serve` (see [Remote access](./docs/user/remote-access.md)).
- Device panel with an Android emulator: `android-tools` and `ffmpeg` (Arch's build includes libx264), plus `android-emulator` and `android-sdk-cmdline-tools-latest` from the AUR and an AVD created with `avdmanager`. Set `ANDROID_HOME` if the SDK is not in a standard location.
- Device panel with a physical Android phone: `android-tools`. The device hub brings its own scrcpy.

The iOS Simulator needs macOS, so the Device panel offers Android only on Arch.

### Server archive

Download `ae-code-linux-x64.tar.gz` from the [latest release](https://github.com/SelfRef/ae-code/releases/latest), unpack it and run:

```bash
./ae-code serve
```

Then open the printed address in a browser. The executable still calls itself `t3` in its help text. For access from a phone or another machine, see [Remote access](./docs/user/remote-access.md).

### Docker

```bash
docker run -d -p 3773:3773 -v ae-code:/home/ae/.ae ghcr.io/selfref/ae-code:latest
```

The image is Ubuntu with `git` and `ssh` and runs as a non-root user; state lives in the `/home/ae/.ae` volume. It contains no agent CLIs: derive an image to add the ones you use.

### Android

Install `ae-code-<tag>.apk` from the [latest release](https://github.com/SelfRef/ae-code/releases/latest) and pair it with a running server.

### From source

```bash
curl -fsSL https://vite.plus | bash   # installs the global `vp` command
vp i
vp run dev
```

Read [AGENTS.md](./AGENTS.md) before changing anything: it covers dev servers, test data, checks and the fork's git rules. Build and architecture notes start at [docs/internals/overview.md](./docs/internals/overview.md).

## Documentation

Full docs live in [docs/](./docs). The user docs are upstream's and still say `~/.t3` where this fork uses `~/.ae`.

- [FAQ](./docs/user/faq.md)
- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Memory](./docs/user/memory.md)
- [MCP servers](./docs/user/mcp-servers.md)
- [Connect Claude Code, Codex, ChatGPT and other agents over MCP](./docs/user/outside-agents.md)
- [Source control integrations](./docs/user/source-control.md)
- [Run as a background service](./docs/user/background-service.md)

## Contributing

This is a personal fork, public so that you can read it, fork it or take a patch from it. If you want a feature of T3 Code itself, start with [upstream](https://github.com/pingdotgg/t3code).

## Licence

Same as upstream; see [LICENSE](./LICENSE).
