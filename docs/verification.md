# Verification and reproduction

## Evidence (2026-10-23 UTC)

Pinned components:

- Node **24.19.0** for launcher and test orchestration.
- Official `@opencode-ai/plugin` **1.19.4**, Zod **4.1.8**; lockfile integrity pins,
  installed with lifecycle scripts disabled.
- Official Linux x64 OpenCode **1.19.4**, embedded Bun **1.4.4**; npm tarball
  integrity and executable SHA256 pinned in the fixture/launcher.
- Shared broker/reference **`ba2219cd87a1feac23e01b23d2c2b3d3bdd65359`**,
  source-byte verified before import.

The aggregate suite has **25 tests**. The final exact-SHA CI and independent-review
checkpoint is recorded in the draft PR. A skipped optional native test is not a
native pass; CI supplies the pinned binary so it must execute that test.

### Shared transport and factory gate

The original 16 tests exercise the official native helper and strict shared
schemas; exact session/project/worktree/lifetime/cancellation guards; reconnect
and close-during-registration/final-epoch races; metadata/send-key recovery;
concurrent native contexts; hostile-text provenance; inbox dedupe/FIFO blocking;
and pre-import reference tamper/symlink refusal.

One test uses an **actual local HTTP broker + BrokerClient + SQLite inbox** and
native tool-helper execute calls. It verifies durable delivery, cooperative peek,
reply and same-key retry. Its host lifecycle is simulated. Credentials are random
fixture values; HTTP is only the explicit numeric-loopback development mode.

### Fresh owned-run gate

Eight focused tests cover fixed no-attach/no-resume/no-auto arguments, policy and
plugin overlay preservation, unbound native proxies, exact fresh root creation,
second-root/deletion/marker revocation, PID/starttime/boot-ID mismatch, symlink
records, old or parented native sessions, concurrent disposal and bounded SDK
reads that never settle.

The ninth uses the **actual pinned OpenCode CLI and actual `launchOwnedRun`**:
private child-incarnation record → native root session/chat hooks → cooperative
list/send/receive tools → close/dispose → marker revocation. Its deterministic
local provider receives the fixed untrusted-agent provenance inside the actual
model-facing tool result, not just terminal output. Existing `bash: deny` policy
is retained; an attempted fixture command does not execute. A swallowed/no-plugin
startup followed by native exit zero is rejected for missing binding proof, with
no automatic retry of the prompt.

**Boundary:** that native test substitutes a fixture plugin constructor only to
inject fake broker client methods. The adapter factory, shared runtime and SQLite
are real; the default production HTTPS transport is not exercised inside that
same native process. This gate and the separate real-broker transport gate must
not be represented as one live end-to-end transport certification.

## Reproduce in isolated local directories

The repository-local installs below do not alter a global CLI or package prefix:

```sh
node --version # v24.19.0
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix test/official-cli --ignore-scripts --no-audit --no-fund
echo '538fcb1b6408c8d4608822acee19f7ff5b3a3eb3383c0633c4f06170857312a7  test/official-cli/node_modules/opencode-linux-x64/bin/opencode' | sha256sum -c -
export BROKER_REFERENCE_DIR=/absolute/path/to/pinned/ai-agent-msg-broker
export OPENCODE_TOOL_MODULE="$PWD/node_modules/@opencode-ai/plugin/dist/tool.js"
export OPENCODE_BINARY="$PWD/test/official-cli/node_modules/opencode-linux-x64/bin/opencode"
npm run check
npm test
```

The reference checkout must include its `test/helpers.mjs` for the local HTTP
fixture. The native test uses disposable HOME/project/config/state and a local
file-backed model module; no real provider authentication or model call is used.
No test paths or credentials are exposed as model tool arguments. GitHub Actions
pins actions, helper/executable packages, the shared reference and Node, and runs
only isolated tests—not deployment.

## Still not verified or implemented

Real provider credentials/native permission UI; default-plugin-to-real-HTTPS
transport in the actual CLI; arbitrary existing plugin combinations; other
OpenCode versions/platforms; existing TUI/server-session attachment; native
consumption receipts; automatic input insertion/wakeup or atomic human/agent
arbitration; per-CLI Podman containers or two-host LAN operation.

`broker_receive` remains a non-consuming FIFO **peek**. A native tool return or
model read does not advance the inbox. See [owned-run instructions](owned-run.md)
for operator requirements and failure/unknown-outcome behavior.
