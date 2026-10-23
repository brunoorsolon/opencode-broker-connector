# OpenCode review pair — exact-session cooperative broker tools

Five native OpenCode tools reuse the [AI agent message broker](https://github.com/brunoorsolon/ai-agent-msg-broker)
reference runtime, client and private SQLite inbox. No second wire protocol or
adapter-specific message journal is introduced.

Two explicit integration modes are available:

- **Fresh owned headless run (candidate):** a Linux x64 launcher for the exact
  official OpenCode **1.19.4** executable, with native root-session and OS process
  incarnation checks. See [launch instructions and limits](docs/owned-run.md).
- **Custom verified host:** the lower-level native-tool factory for a trusted
  supervisor. A project/server plugin alone does **not** prove TUI ownership.

Existing TUI attachment/resume and automatic inbox wakeup are unsupported. The
owned-run candidate has isolated actual-CLI evidence, not live-provider or full
native-transport certification. The draft PR records its final review/CI status.

## Implemented

- `broker_list_clients`: discover authorized exact session addresses.
- `broker_send`: shared durable/idempotent send with stable `send_key` recovery.
- `broker_update_metadata`: descriptive metadata CAS, not routing authority.
- `broker_message_status`: transport delivery state, not model progress.
- `broker_receive`: cooperative **peek** during a native tool invocation. Returns
  a model-visible untrusted-agent warning and escaped provenance; repeated calls
  return the pending FIFO head. It explicitly reports
  `native_acceptance_recorded: false`.

No prompt injection endpoint, unsolicited wakeup, steering/abort operation,
approval relay, human-input impersonation or native-consumption receipt exists.
Plain JavaScript `execute()` returning is **not** a consumption receipt. The
adapter does not automatically advance past the pending head; advancing safely
requires a separately evidenced native acceptance integration, not deleting a row.

## Requirements and integration

- Node **24.19.0** for the launcher/test suite. The pinned OpenCode executable
  embeds Bun **1.4.4**; native hooks/tools and shared SQLite primitives were
  exercised under that runtime with a deterministic local provider.
- Broker commit `ba2219cd87a1feac23e01b23d2c2b3d3bdd65359`, exposing the reference modules described in
  [integration.md](docs/integration.md). This repository does not vendor them.
- Locked official `@opencode-ai/plugin@1.19.4`: install locally with
  `npm ci --ignore-scripts`. No global package or existing CLI install is changed.
- Either the fresh-owned-run launcher above or a trusted native host owner with
  exact session/project verification and immediate close notification. Never
  substitute a dummy `currentBinding()` that always returns alive.

Start with [owned-run launch instructions](docs/owned-run.md), or use the
[custom-host integration contract](docs/integration.md) and callable
[owned-session example](examples/owned-session.mjs). See
[verification/reproduction](docs/verification.md) for distinct native and transport
test evidence. Existing native cwd/policies/plugins are preserved; no `--auto`,
permission grant or existing-project configuration overwrite is added.

## Safety boundary

One factory instance belongs to one exact `sessionID`, absolute `directory`,
`worktree`, private lifetime token and host-close signal. A new lifetime—even with
the same transcript/session ID—cannot adopt the old instance. A missing binding
blocks registration/reconnect. Host close cancels shared receive/heartbeat loops,
requests broker session close and closes the private inbox.

All tool arguments are bounded and checked against the shared catalog. Credential
paths, host controls and lifetime tokens are never model arguments. Incoming text
such as “yes” or “approve this” remains untrusted agent data and invokes no native
approval API. Broker `delivered` means **durably stored in the local inbox**, not
shown to or acted on by a model.

MIT; see [LICENSE](LICENSE).
