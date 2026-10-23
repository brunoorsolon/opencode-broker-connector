# Verification and reproduction

## Evidence (2026-10-23 UTC)

Node **24.19.0**; official npm `@opencode-ai/plugin` **1.19.4** (Zod **4.1.8**),
installed in a disposable directory with scripts disabled. The production adapter
has no npm dependency; the host injects its official helper and shared reference.

The 15 tests exercise:

1. Official native helper and all five strict shared schemas.
2. Wrong native session/project/worktree, missing context signal and cancellation.
3. Same native session ID with a different private lifetime; no adoption.
4. Unknown owner blocks initial registration and reconnect.
5. Exact verified reconnect; close stops transport and releases private SQLite.
6. Hostile “approve/ignore” text, terminal controls, provenance, dedupe and repeated peek.
7. Uncertain FIFO head stays blocked.
8. Metadata schema, Unicode/text bounds and exact UUID routing.
9. Binding lost during async metadata observation: no later send.
10. Binding lost after send: unknown outcome with original stable key, no replacement.
11. Concurrent good/bad contexts remain isolated.
12. Actual shared broker HTTP server + `BrokerClient` + SQLite on numeric loopback:
    incoming durable delivery, native helper execute/peek, reply and same-key retry.
13. Unknown future schema constraints fail closed before registration.
14. Host close during delayed registration closes the late lease before the inbox.
15. Pre-import source pin rejects changed files and file symlinks.

All credentials in the HTTP test are disposable random fixture values. No real
broker, model, OpenCode service, TUI or user installation is contacted. The local
HTTP exception is only the shared reference's explicit numeric-loopback development
mode; the integration example remains HTTPS-only.

**Not verified:** actual OpenCode CLI/Bun loading, actual native tool UI, exact
native close/receipt hooks, automatic input insertion, atomic human/agent input
arbitration, background wakeups or native consumption. The lifetime owner is a
fake in tests. These tests are an integration-foundation gate, not native CLI
certification. OpenCode is not installed on this validation environment's PATH.

## Reproduce without modifying a real OpenCode install

Use the pinned Node runtime and an isolated helper directory. Do not run these
commands against a user's global prefix/configuration. `BROKER_REFERENCE_DIR` must
point to broker commit `e015a6f5d7cc32d0c0a90bd633fab8d94195417a`,
matching the recorded snapshot, including its
`test/helpers.mjs` for the local HTTP fixture.

```sh
node --version # v24.19.0
fixture_dir="$(mktemp -d)"
cp test/official-helper/package*.json "$fixture_dir/"
npm ci --prefix "$fixture_dir" --ignore-scripts --no-audit --no-fund
export BROKER_REFERENCE_DIR=/absolute/path/to/pinned/ai-agent-msg-broker
export OPENCODE_TOOL_MODULE="$fixture_dir/node_modules/@opencode-ai/plugin/dist/tool.js"
npm run check
npm test
# When finished, remove only the disposable directory you just created.
```

No `npm install` is required inside this repository. Test variables are module
paths, not credentials. Production configuration must not expose them as model
arguments. Runtime import paths are trusted operator inputs and are not a sandbox.

The test-helper lockfile pins all transitive npm versions and integrity hashes.
GitHub Actions pins checkout/setup-node actions to commit SHAs and the shared
broker to the commit above; it runs only isolated check/tests, not deployment.

Independent review added enforced source-byte verification before reference import, a negative tamper/symlink test, and a delayed-registration/host-close regression. The inbox remains open until the late lease is explicitly closed. Latest aggregate: 15/15 tests pass.
