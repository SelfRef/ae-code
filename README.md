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
- **GNOME desktop in the Device panel.** A headless GNOME Shell session next to the Android emulator, for testing GTK apps and Shell extensions: you and agents see and drive the same screen, streamed as H.264 (GPU-encoded where VA-API is available). It runs in a container without a display or a logged-in user. ([guide](./docs/user/devices.md#gnome-desktops))

### Privacy

- **No product analytics.** The server sends no usage events unless `T3CODE_TELEMETRY_ENABLED=true`.

### Running and releasing

- **Its own identity.** App id `dev.aperte.AECode`, state in `~/.ae`, Electron profile `ae-code`: it runs next to upstream's T3 Code without sharing data. Data written by T3 Code is not read; see "Data migration" in [ROADMAP.md](./docs/ROADMAP.md).
- **Android app.** Package `dev.aperte.aecode`, built and signed by the release workflow and attached to each release as an APK.
- **Docker image.** The release server on GHCR, `ghcr.io/selfref/ae-code`.
- **Date-versioned releases.** `vYYYY.MM.DD` releases with the Linux x64 server archive, published when `main` has new changes.

## Install

The releases carry the Linux x64 server (archive and Docker image), the Linux x64 desktop app (through the AUR) and the Android app. There is no desktop installer (AppImage, `.deb`), no iOS app and no `npx` launcher. Install and sign in to at least one agent CLI on the machine that runs the server (Claude Code, Codex, Cursor, OpenCode and so on), or install Claude Code and OpenCode from Settings → Providers after the first start.

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
- `glab`, `forgejo-cli` or `gitea-cli`: GitLab, Forgejo and Gitea (`gt auth login`).
- `tailscale`: remote access with `t3 serve --tailscale-serve` (see [Remote access](./docs/user/remote-access.md)).
- Device panel with an Android emulator: `nodejs` (the device hub is a Node program; without it the panel reports "Local device support requires Node.js"), `android-tools` and `ffmpeg` (Arch's build includes libx264), plus `android-emulator` and `android-sdk-cmdline-tools-latest` from the AUR and an AVD created with `avdmanager`. The emulator's bundled qemu also needs `libxkbfile` (`extra`), or it fails with `error while loading shared libraries: libxkbfile.so.1`. The panel finds the SDK through `ANDROID_HOME`, which a service started by systemd does not inherit from your shell: set it in the unit (`Environment=ANDROID_HOME=%h/Android/Sdk`) and restart.
- Building the Android app yourself (`vp run mobile:install android` when no prebuilt client is cached): `jdk21-openjdk` (it replaces `jre21-openjdk-headless`; Gradle needs `javac`), plus the SDK packages the React Native version in `apps/mobile` pins, installed with `sdkmanager` after `yes | sdkmanager --licenses`: `platforms;android-37.0`, `build-tools;37.0.0` and `ndk;27.1.12297006` (see `node_modules/react-native/gradle/libs.versions.toml`). Set `JAVA_HOME=/usr/lib/jvm/java-21-openjdk`.
- Device panel with a physical Android phone: `android-tools`. The device hub brings its own scrcpy.
- Device panel with a GNOME desktop (for GTK apps and Shell extensions): `gnome-shell`, `pipewire`, `wireplumber`, `gst-plugin-pipewire`, `gst-plugins-good`, `python-gobject`, `gst-python` and `at-spi2-core`, plus `nodejs` for the device hub. For the live H.264 stream add `gst-plugin-va` with your GPU's VA-API driver (Mesa's for AMD, `intel-media-driver` for Intel), or `gst-plugins-ugly` to encode in software; without either the panel falls back to a still-image stream. The session is separate from your own GNOME login and needs no display. See [GNOME desktops](./docs/user/devices.md#gnome-desktops) for the Debian and Ubuntu packages.

The iOS Simulator needs macOS, so the Device panel offers Android and GNOME desktops on Arch.

### Server on a bare host

Download `ae-code-linux-x64.tar.gz` from the [latest release](https://github.com/SelfRef/ae-code/releases/latest) and unpack it. To try it, run `./ae-code serve` and open the printed address. To keep it running (Linux with systemd):

```bash
tar -xzf ae-code-linux-x64.tar.gz
cd ae-code-linux-x64
./install.sh
```

`install.sh` runs as your user (not root). It installs a systemd user service on port 3773 that starts at boot and restarts after a crash, and links `~/.local/bin/ae-code`. `ae-code pair` prints a QR code to pair a client. State is in `~/.ae`; [INSTALL.md](./packaging/systemd/README.md) in the archive covers configuration and rollback. The service sets `T3CODE_SELF_UPDATE=true`, so Settings → About (or the update dialog of another client) installs newer releases from GitHub and restarts the server; delete that line from the unit to turn it off. Without the switch, a plain `ae-code serve` has to be updated by replacing the executable. The executable still calls itself `t3` in its help text. For access from a phone or another machine, see [Remote access](./docs/user/remote-access.md).

### Docker

```bash
docker run -d -p 3773:3773 -v ae-code:/home/ae/.ae ghcr.io/selfref/ae-code:latest
```

The image is Ubuntu with `git`, `ssh` and the source-control CLIs `gh`, `glab`, `fj` and `gt`, and runs as a non-root user; state lives in the `/home/ae/.ae` volume. It is a base image meant to be extended, so it has no agent CLIs (install them from Settings → Providers, or bake them in), no language toolchains and no Android SDK. Derive an image to add what your projects need, for example:

```dockerfile
FROM ghcr.io/selfref/ae-code:latest
USER root
# Toolchains and build tools for the projects your agents work on: Node.js, Rust, Python, Go, a C compiler, make, jq, ripgrep.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential nodejs npm python3 golang-go jq ripgrep \
 && rm -rf /var/lib/apt/lists/*
# Agent CLIs you want ready at the first start: Claude Code, Codex, OpenCode.
RUN npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai
USER ae
```

Other things worth adding the same way: an Android SDK (with `/dev/kvm` passed to the container for an emulator), the [GNOME desktop packages](./docs/user/devices.md#gnome-desktops) (pass a `/dev/dri/renderD*` node for GPU encoding), a Docker CLI, Playwright's browsers, a CLI for another forge such as `az` for Azure DevOps, and your own SSH keys or git config. Add `-e T3CODE_SELF_UPDATE=true` to let Settings → About install newer releases in place (the server restarts, the container does not); otherwise pull a newer image.

### Desktop app (Arch Linux)

The Linux x64 desktop app is packaged for the AUR: `ae-code-bin` (the release build, prebuilt), `ae-code` (the latest release built from source) and `ae-code-git` (the latest commit).

```bash
yay -S ae-code-bin
```

The app has its own server and its own state in `~/.ae`. It does not update itself: update it with your AUR helper (`yay -Syu`). The update dialog says so instead of offering an app update, and provider CLIs installed by pacman or another package manager are left to it as well.

### Android

Install `ae-code-<tag>-arm64-v8a.apk` (phones; `-x86_64` is for emulators) from the [latest release](https://github.com/SelfRef/ae-code/releases/latest) and pair it with a running server. With [Obtainium](https://obtainium.imranr.dev/) it updates itself from the releases; set its APK filter regex to `arm64-v8a` so it skips the emulator build.

<p align="center">
  <a href="https://github.com/SelfRef/ae-code/releases/latest"><img src="https://raw.githubusercontent.com/Kunzisoft/Github-badge/main/get-it-on-github.png" alt="Get it on GitHub" height="60"></a>
  <a href="https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/SelfRef/ae-code"><img src="https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png" alt="Get it on Obtainium" height="60"></a>
</p>

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
