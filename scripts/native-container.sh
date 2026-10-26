#!/usr/bin/env bash
# Isolated test host wrapper. Not an installation or operator onboarding command.
set -euo pipefail
runtime=${PSST_CONTAINER_RUNTIME:-docker}
image=${PSST_CONTAINER_IMAGE:?Set the reviewed native fixture image}
repo=${PSST_CONTAINER_REPO:?Set the connector checkout path}
binary=${PSST_REAL_OPENCODE_BINARY:?Set the integrity-verified official fixture binary}
# Native tests put their home, code/provider fixture and private installation under one disposable root.
case "$HOME" in /tmp/psst-native-https-*/home|/tmp/psst-native-https-*/fresh-home) ;; *) echo 'fixture_home_required' >&2; exit 2;; esac
fixture=${HOME%/*}
name="psst-opencode-test-${PPID}-$$"
cleanup() { "$runtime" rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'cleanup; exit 143' TERM INT
args=(run --rm --init --name "$name" --label psst-native-approval-fixture=true --network host --user "$(id -u):$(id -g)"
  --mount "type=bind,src=$repo,dst=$repo,readonly"
  --mount "type=bind,src=$fixture,dst=$fixture"
  --workdir "$PWD")
if [[ "$runtime" == podman ]]; then args+=(--userns keep-id); fi
for key in HOME XDG_CONFIG_HOME XDG_DATA_HOME XDG_CACHE_HOME XDG_STATE_HOME OPENCODE_DISABLE_MODELS_FETCH PSST_OPENCODE_CONFIG_DIR; do
  args+=(-e "$key=${!key:-}")
done
if [[ -n "${NODE_EXTRA_CA_CERTS:-}" ]]; then
  ca_dir=$(dirname "$NODE_EXTRA_CA_CERTS")
  args+=(--mount "type=bind,src=$ca_dir,dst=$ca_dir,readonly" -e "NODE_EXTRA_CA_CERTS=$NODE_EXTRA_CA_CERTS")
fi
# Container-local /tmp is never shared; runtime hints cannot cross host incarnations.
"$runtime" "${args[@]}" "$image" "$binary" "$@" &
wait $!
