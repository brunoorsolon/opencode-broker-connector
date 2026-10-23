# OpenCode review pair — cooperative broker adapter foundation

Five native OpenCode tools reuse the [AI agent message broker](https://github.com/brunoorsolon/ai-agent-msg-broker)
reference runtime, client and private SQLite inbox. No second wire protocol or
adapter-specific message journal is introduced.

**Status: integration foundation, not a drop-in certified OpenCode extension.**
The native tool helper is tested; actual OpenCode CLI/TUI lifecycle integration is
not. A project/server plugin initializer does not, by itself, prove ownership of
one exact TUI session lifetime. Do not configure a dummy `currentBinding()` that
always says a host is alive.

An unfinished fresh-owned-run launcher is being preserved on this feature branch;
see [the explicit WIP checkpoint](docs/owned-run-checkpoint.md). It is not yet an
operator-supported launch path.

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

- Node **24.19.0**, with built-in SQLite, for this reference adapter/test suite.
  OpenCode's separate Bun runtime is **not certified** by these Node tests.
- Broker commit `ba2219cd87a1feac23e01b23d2c2b3d3bdd65359`, exposing the reference modules described in
  [integration.md](docs/integration.md). This repository does not vendor them.
- OpenCode's official `tool` helper, injected by the integrating host. Tests used
  `@opencode-ai/plugin@1.19.4`; no runtime npm dependency is installed here.
- One trusted native host owner capable of exact session/project verification and
  immediate close notification. If that capability is unavailable, do not enable
  background broker registration/heartbeats for the session.

See [integration and configuration](docs/integration.md), the callable
[owned-session example](examples/owned-session.mjs), and
[verification/reproduction](docs/verification.md). The example is a function for
an existing verified supervisor, not a shell launcher or an auto-attach plugin.
Existing OpenCode installations/configuration are unchanged.

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
