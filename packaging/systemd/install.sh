#!/bin/sh
# Installs this release as a systemd user service for the current user: it starts at boot, restarts
# after a crash and can update itself from a client. Run it from the unpacked archive; run it again
# with a newer archive to update by hand. AE_CODE_PREFIX moves the install (default ~/.local/opt/ae-code).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
prefix=${AE_CODE_PREFIX:-$HOME/.local/opt/ae-code}
units=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user

[ "$(id -u)" -ne 0 ] || { echo "Run this as the user the agents should run as, not as root." >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemd is required." >&2; exit 1; }
[ -x "$here/ae-code" ] && [ -f "$here/ae-code.service" ] || { echo "Run install.sh from the unpacked archive." >&2; exit 1; }

# Copy next to the target and swap, because a running executable cannot be overwritten in place.
if [ "$here" != "$prefix" ]; then
  mkdir -p "$(dirname "$prefix")"
  rm -rf "$prefix.new" "$prefix.old"
  cp -a "$here" "$prefix.new"
  [ ! -e "$prefix" ] || mv "$prefix" "$prefix.old"
  mv "$prefix.new" "$prefix"
  rm -rf "$prefix.old"
fi

mkdir -p "$HOME/.local/bin" "$units"
ln -sf "$prefix/ae-code" "$HOME/.local/bin/ae-code"
sed "s|@PREFIX@|$prefix|g" "$prefix/ae-code.service" > "$units/ae-code.service"

systemctl --user daemon-reload
systemctl --user enable ae-code.service
systemctl --user restart ae-code.service
# Without lingering, a user service stops at logout and does not start at boot.
loginctl enable-linger "$USER" 2>/dev/null || echo "Run 'loginctl enable-linger $USER' (as root if needed) to keep it running when you are logged out."

echo "AE Code is running on port 3773. Status: systemctl --user status ae-code"
echo "Pair a client:  $HOME/.local/bin/ae-code pair"
