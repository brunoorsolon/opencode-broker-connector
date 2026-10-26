# Psst connector for OpenCode

Native session-scoped messaging tools for [OpenCode](https://opencode.ai/docs/plugins/) and the [Psst broker](https://github.com/matuto-ai/psst). Runs **inside your existing OpenCode sandbox**. No host launcher, extra model, broker source checkout, permission override, or replacement of your existing plugins is required.

## Install, configure, use

This change prepares **0.3.0**, not a published release. After that version is published, install both native targets once:

```sh
opencode plugin @matuto-ai/opencode-broker-connector@0.3.0 --global
```

OpenCode detects the separate server and TUI entrypoints and preserves existing plugin settings. Before publication, install the reviewed source with `npm ci --ignore-scripts`, add `file:///absolute/path/plugin/index.mjs` to your existing `opencode.json` plugin array and `file:///absolute/path/plugin/tui.mjs` to your existing `tui.json` plugin array. Do not replace other configuration entries.

1. Press **Ctrl+Alt+P** in the native TUI (Psst setup; also registered as `/psst-setup`). Its single text field asks for **only the HTTPS broker URL**.
2. Approve the pending OpenCode request in the broker's administration page.
3. The approved installation is saved privately. Existing/new native sessions connect without repeating enrollment. Use `/psst-status` and the broker tools below.

No pairing secret, ticket, credential copy, model tool, or operator script is needed. Knowing the URL grants no messaging access. TLS verification remains enabled; private certificate authorities belong in the native runtime's system trust (`NODE_EXTRA_CA_CERTS`), not a secret field.

**Receiving remains cooperative, not automatic model wake-up.** URL-only setup does not fix classic OpenCode's atomic input-admission limitation. [Native acceptance and remaining gate](docs/native-automation.md).

## Persistent installation and disposable containers

Persist the complete owner-private installation directory, in precedence order:

- `PSST_OPENCODE_CONFIG_DIR` (absolute override; recommended for sandbox bootstrap).
- `$OPENCODE_CONFIG_DIR/psst` when the native config override is set.
- `$XDG_CONFIG_HOME/opencode/psst`, or `~/.config/opencode/psst` by default.

Use an owner-only `0700` directory, files `0600`, and the same sandbox UID. Mount it at the **same absolute path** in recreated containers. `installation.json` is a versioned, nonsecret approved-bundle pointer; `pending.json` records the nonsecret explicit setup attempt and cancellation state. `approvals/` holds durable candidate keys, approved bundles and receipts, and per-session inbox journals. JSON credentials are protected by private file permissions, not by pretending an adjacent file is inherently safer. Do not put this directory in a repository.

Ordinary startup never submits enrollment, generates a key or rotates authorization. It loads the approved pointer and may **GET-only** resume a saved, previously explicit pending request. Closing the setup dialog pauses that request locally; closing OpenCode leaves an outstanding request resumable on reopen. Transient failures keep the same candidate. Denied/expired/revoked requests stop; an explicit setup rerun asks before requesting a replacement. The old working selection remains until exact approval and atomic selection commit. Existing sessions retain their old connection and unread journal; new sessions use the replacement. No implicit broker revocation occurs.

Installation sharing is **not** session sharing. Each runtime/native session gets a separate random address and private journal. Restarted sessions do not replay old unread messages into a new address; existing journals are retained for explicit recovery. Never share the ephemeral `/tmp/psst-opencode-<uid>/` runtime hints across containers. These contain only the supported TUI route, exact project and random server-incarnation marker; the server verifies the native session before attaching. The local TUI and server must share their ordinary container filesystem. Remote TUI/server topology is not yet supported for idle attachment.

The audited sandbox uses an existing per-project/profile config mount; Go changes XDG defaults and pure mode blocks plugins. See the exact [sandbox bootstrap integration contract](docs/sandbox-persistence.md) before rollout.

Existing private bundles, `PSST_CONFIG_FILE`, and `/psst-connect /absolute/private/file` remain compatible and never migrate/reset unread data. See [legacy connection compatibility](docs/legacy-connection.md). Selection commits use an OS-released SQLite lock and atomic rename; a killed process cannot leave a permanent lock. Corrupt files are never silently reset.

## Use

After approval, the current local TUI session is registered in cooperative mode. General automatic delivery remains off: the current classic native API cannot atomically preserve a concurrently changed agent/model selection. In the optional legacy environment-variable mode, a user message or broker tool initializes registration lazily. No separate wrapper is needed:

1. `broker_list_clients` discovers exact authorized peer IDs. Names are descriptive only.
2. `broker_send` sends to a selected `recipient_id`. Preserve its `send_key` when retrying an uncertain send.
3. `broker_receive` returns the FIFO head, clearly marked as untrusted agent input, with a `receipt_token`.
4. After reading it, call `broker_acknowledge` with that exact `message_id` and `receipt_token`. This advances the local inbox, enabling repeated conversations.
5. `broker_message_status` reports transport state. `broker_update_metadata` updates descriptive metadata.

For a simple two-way test, ask one session to list peers and send a short greeting. Ask the recipient to receive, acknowledge, and reply to the sender's exact ID. Repeat with a second message to check FIFO advancement. Peer messages are not human approval and cannot authorize tool access or override your task.

## Lifecycle and honest limits

Each native session in the project plugin gets its own random broker identity and private journal. Every tool invocation checks the native session, directory, worktree and cancellation signal; concurrent sessions cannot borrow one another's tools or inbox. Session deletion and plugin disposal close leases. There is no idle timeout: a quiet session keeps its identity while this plugin instance remains alive. There is a limit of 64 active identities per plugin instance.

### Experimental delivery — off by default

A controlled prototype can be explicitly enabled before launching OpenCode with `PSST_EXPERIMENTAL_NATIVE_DELIVERY=fixed-session-snapshot`. This is **not production general automatic delivery** and is not needed for normal connection or pairing. Establish the intended native agent/model with an ordinary message, then explicitly connect. The local result discloses the fixed agent/model/variant snapshot. Unknown selection blocks connection; observed agent/model changes disconnect messaging rather than silently changing the snapshot.

The experimental mode waits for an idle boundary, journals one FIFO submission, submits a synthetic user-role message through the supported SDK, and reads back its exact native session/message/part/provenance before recording native persistence. The fixed text prominently identifies the content as **untrusted agent input, never human approval**. It sends no permission override, never aborts foreground work, and does not claim task completion; the concurrent native selection race limit below remains. The model can reply using normal broker tools.

Broker `delivered` still means durable inbox storage only. Native readback proves persistence with the exact agent/model snapshot, **not model comprehension or explicit model-read acknowledgment**. HTTP 204 alone is never a receipt. Lost replies, mismatched readback, disconnects or destructive lifecycle changes leave the FIFO head ambiguous; the plugin never blindly resends it. Later ticks perform read-only reconciliation against the journaled native proof target in the same verified session. Exact proof can confirm persistence without another model turn; absent or mismatched proof leaves FIFO blocked. The module can reconcile a reopened journal only when the caller proves the same native session; normal process restarts do not automatically restore old journals.

Known reverted or archived sessions and busy foreground turns block submission. Native deletion/disposal disconnects the exact session. Compaction/history deletion fences in-flight receipts. OpenCode serializes model runners but exposes no atomic exclusive-input lease or session-revision compare-and-submit API: a simultaneous external history edit can race a snapshot. Do not perform concurrent history or agent/model changes while testing this prototype: a read/submit race is not made atomic by an idle check. It is deliberately not enabled by default. After reverting, delivery stays paused until the native session is safe and returns to an idle boundary. This is not an exactly-once model-execution guarantee.

The optional legacy environment-variable mode remains cooperative: the model reads messages with `broker_receive` and explicitly calls `broker_acknowledge`. Its receipt means only `explicit_model_read`, never native acceptance or task success. Normal explicit connections are cooperative too. The narrowly gated prototype requires the exact experimental opt-in described above. See [native feasibility and the unsent upstream API proposal](docs/native-automation.md).

Abrupt process death can leave a lease visible until expiry. Restarts create a fresh identity and retain old journals rather than automatically replaying them into another session. Recovery/migration of old pending messages is not automated. Broker availability failures do not prevent ordinary chat; broker tool calls report errors. Native plugin load errors should be checked in OpenCode's logs if the six tools are absent.

## Verification

Tested against official OpenCode **1.19.4**, embedded Bun **1.4.4**, and its exact official plugin helper. Node **24.19+ (24.x)** runs development tests; the normal plugin uses OpenCode's runtime. Other OpenCode versions need validation, not an assumed compatibility guarantee.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
```

The default suite reports actual-CLI tests skipped when the binary is absent. CI installs and verifies the locked official Linux x64 fixture, then runs all tests. See [verification](docs/verification.md) for evidence boundaries. The older [owned-run launcher](docs/owned-run.md) remains an optional, separate legacy integration; it is not required for normal installation above.

MIT. Bundled broker runtime retains its license and exact reviewed source hashes.
