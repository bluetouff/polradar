#!/usr/bin/env bash
set -euo pipefail
umask 077
key_dir=$(mktemp -d "$RUNNER_TEMP/polradar-push.XXXXXX")
trap 'rm -f -- "$key_dir/key" "$key_dir/known_hosts"; rmdir -- "$key_dir"' EXIT
test -n "$POLRADAR_DATA_PUSH_KEY"
printf '%s\n' "$POLRADAR_DATA_PUSH_KEY" > "$key_dir/key"
unset POLRADAR_DATA_PUSH_KEY
printf '%s\n' 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' > "$key_dir/known_hosts"
export GIT_SSH_COMMAND="ssh -F /dev/null -i \"$key_dir/key\" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o UpdateHostKeys=no -o UserKnownHostsFile=\"$key_dir/known_hosts\" -o GlobalKnownHostsFile=/dev/null -o ConnectTimeout=15"
git push ssh://git@github.com/bluetouff/polradar.git HEAD:refs/heads/main
