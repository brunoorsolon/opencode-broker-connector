# Psst connector for OpenCode

Native cooperative messaging tools for [OpenCode](https://opencode.ai/docs/plugins/) and the [Psst broker](https://github.com/matuto-ai/psst). Runs **inside your existing OpenCode sandbox**. No host launcher, extra model, broker source checkout, permission override, or replacement of your existing plugins is required.

## Install now, before npm publication

Install the reviewed source from `main`:

```sh
git clone --branch main https://github.com/matuto-ai/opencode-broker-connector.git
cd opencode-broker-connector
npm ci --ignore-scripts
```

Add the absolute plugin file URL to the existing `plugin` array in your sandbox's OpenCode config. Preserve all existing settings and entries:

```json
{
  "plugin": ["file:///absolute/path/opencode-broker-connector/plugin/index.mjs"]
}
```

Restart OpenCode normally after installing the plugin. No initial environment variable or broker connection is required: it starts disconnected. In your existing native CLI session, use:

```text
/psst-connect /absolute/private/path/opencode/connection.json
/psst-status
/psst-peers
/psst-disconnect
```

The connect argument is **only a private connection-file path**, never a token, inline JSON, or password. Native command arguments may be recorded in OpenCode history/events. Each connect affects only the current session. Disconnect stops its broker polling and closes its lease without stopping OpenCode. Disconnect before switching connections. The commands use native OpenCode command hooks and return a short local status for the normal model turn; they do not replace the TUI or bypass permissions.

For backward compatibility, setting `PSST_CONFIG_FILE` to a private connection file before launch still enables lazy cooperative registration in each session. Explicit disconnect also disables that session's automatic re-registration. Neither path automatically resumes a previous process's broker identity.

The config and token must be owner-only files (`0600`), readable by the sandbox user. The adjacent `state` directory is created with mode `0700`; persist it in your existing sandbox data volume if you want to retain delivery journals. Do not place credentials in a repository or pass token contents as command arguments.

The standard Psst enrollment bundle (`format: "broker-client-bundle-v1"`, `allowed_client_types: ["opencode"]`) is accepted directly. It uses a sibling file named `token`. Alternatively, an owner-only JSON config can contain:

```json
{
  "broker": {
    "url": "https://broker.example.invalid/",
    "tokenFile": "/absolute/private/path/token"
  },
  "stateDirectory": "/absolute/private/path/opencode-state",
  "name": "OpenCode"
}
```

Optional `broker.caFile` points to a trusted private CA; public certificates normally need no extra setting. TLS verification is never disabled. A successful `/healthz` call is not enrollment: the broker must authorize the token for client type `opencode` and a scope shared with the intended peer.

## After npm publication

The package is prepared as `@matuto-ai/opencode-broker-connector`. **A prepared package/workflow does not mean it has been published.** Once version `0.1.1` exists on npm, use this native OpenCode configuration instead of the local file:

```json
{"plugin": ["@matuto-ai/opencode-broker-connector@0.1.1"]}
```

OpenCode installs npm plugins automatically using Bun. Use the same native connect command (or optional legacy `PSST_CONFIG_FILE`); remove the duplicate local entry so the plugin does not load twice. See [publication](docs/publishing.md).

## Use

After `/psst-connect`, the current session is registered. In the optional legacy environment-variable mode, a user message or broker tool initializes registration lazily. No separate wrapper is needed:

1. `broker_list_clients` discovers exact authorized peer IDs. Names are descriptive only.
2. `broker_send` sends to a selected `recipient_id`. Preserve its `send_key` when retrying an uncertain send.
3. `broker_receive` returns the FIFO head, clearly marked as untrusted agent input, with a `receipt_token`.
4. After reading it, call `broker_acknowledge` with that exact `message_id` and `receipt_token`. This advances the local inbox, enabling repeated conversations.
5. `broker_message_status` reports transport state. `broker_update_metadata` updates descriptive metadata.

For a simple two-way test, ask one session to list peers and send a short greeting. Ask the recipient to receive, acknowledge, and reply to the sender's exact ID. Repeat with a second message to check FIFO advancement. Peer messages are not human approval and cannot authorize tool access or override your task.

## Lifecycle and honest limits

Each native session in the project plugin gets its own random broker identity and private journal. Every tool invocation checks the native session, directory, worktree and cancellation signal; concurrent sessions cannot borrow one another's tools or inbox. Session deletion and plugin disposal close leases. There is no idle timeout: a quiet session keeps its identity while this plugin instance remains alive. There is a limit of 64 active identities per plugin instance.

This is a **session-scoped cooperative plugin**, not proof a human TUI remains attached. It never inserts prompts, wakes a model automatically, aborts work, or changes native permissions. Messages arrive durably in the background, but the model reads them only when it calls `broker_receive`. Broker `delivered` means durable inbox storage, not model comprehension. Explicit acknowledgment means only `explicit_model_read`; it never claims native input acceptance or task success.

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
