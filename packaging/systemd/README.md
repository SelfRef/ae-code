# AE Code server on a bare host

This archive is the whole server: the `ae-code` executable, the web client and the libraries it needs.
It needs no Node, npm or containers. Linux x64 with systemd.

## Install

```sh
tar -xzf ae-code-linux-x64.tar.gz
cd ae-code-linux-x64
./install.sh
```

`install.sh` runs as the user the agents should run as (not root). It copies this directory to
`~/.local/opt/ae-code`, links `~/.local/bin/ae-code`, installs and starts the user service `ae-code`
(port 3773 on all interfaces) and enables lingering so it survives logout and starts at boot.

```sh
systemctl --user status ae-code      # state
journalctl --user -u ae-code -f      # logs
ae-code pair                         # a QR code to pair a client with the server
```

The server's state (database, settings, secrets) is in `~/.ae`. Install the agent CLIs you use
(Claude, Codex, ...) for the same user. Put the host behind Tailscale, a VPN or a reverse proxy
before exposing it beyond a trusted network.

## Updating

The unit sets `T3CODE_SELF_UPDATE=true`, so a client (Settings -> About, or the update dialog)
can install newer releases from GitHub: the server downloads one into `~/.ae/updates`, checks it
against GitHub's checksum and restarts from it. To update by hand, run `./install.sh` from a newer
archive. To turn in-app updates off, delete the `Environment=T3CODE_SELF_UPDATE=true` line in
`~/.config/systemd/user/ae-code.service`, then `systemctl --user daemon-reload` and restart.

To roll back an in-app update: `rm -r ~/.ae/updates && systemctl --user restart ae-code`.

## Configuration

Add `KEY=value` lines to `~/.config/ae-code/env` (read by the unit, no quotes) for extra `PATH`
entries, `T3CODE_HOME` or provider keys. Change the port or interface by editing `ExecStart` in the
unit. Run the server without systemd with `T3CODE_SELF_UPDATE=true ae-code serve`.
