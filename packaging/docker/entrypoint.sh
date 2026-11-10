#!/bin/sh
# The image's entrypoint. `ae-code serve ...` runs as it is, unless T3CODE_SELF_UPDATE is on:
# then the server may update itself from Settings -> About. It unpacks the new release into
# <home>/updates/<version> and points <home>/updates/current at it, stops, and this script starts
# it again from the newest release: the image's own (/opt/ae-code) or the downloaded one.
# SIGHUP (`docker kill -s HUP <container>`) restarts the server without recreating the container,
# which also picks up a release placed in <home>/updates by hand.
[ "$1" = ae-code ] || exec "$@"
case "$T3CODE_SELF_UPDATE" in 1 | true | TRUE | True | yes | on) ;; *) exec "$@" ;; esac
shift

baked=/opt/ae-code
updates=${T3CODE_HOME:-$HOME/.ae}/updates
export T3CODE_UPDATE_SUPERVISED=1

current() { cat "$updates/current" 2>/dev/null; }

stopping=
restart=
child=
trap 'stopping=1; [ -n "$child" ] && kill -TERM "$child" 2>/dev/null' TERM INT
trap 'restart=1; [ -n "$child" ] && kill -TERM "$child" 2>/dev/null' HUP

while :; do
  started=$(current)
  bin=$baked/ae-code
  # The image's own server wins over a download that is not newer, such as one left in the volume
  # from before the image was rebuilt.
  baked_version=$(cat "$baked/VERSION")
  if [ -n "$started" ] && [ "$started" != "$baked_version" ] && [ -x "$updates/$started/ae-code" ] &&
    [ "$(printf '%s\n%s\n' "$baked_version" "$started" | sort -V | tail -n 1)" = "$started" ]; then
    bin=$updates/$started/ae-code
  fi
  "$bin" "$@" &
  child=$!
  # A trapped signal ends `wait` early; the child may still be shutting down.
  wait "$child"
  code=$?
  while kill -0 "$child" 2>/dev/null; do
    wait "$child"
    code=$?
  done
  child=
  # Start again only after an update (it moved `current`) or a SIGHUP, never after a stop or a crash.
  if [ -n "$stopping" ] || { [ -z "$restart" ] && [ "$(current)" = "$started" ]; }; then
    exit "$code"
  fi
  restart=
done
