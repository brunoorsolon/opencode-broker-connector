# Legacy connection and pairing compatibility

These paths remain supported for existing installations. They are not the primary onboarding workflow.

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

## Explicit per-session pairing

After the broker enrollment upgrade is reviewed and deployed, follow its [operator pairing guide](https://github.com/matuto-ai/psst/blob/3e908e79966d886a02d372c103e31dec6e900c1a/docs/pairing-operator.md). An operator first authorizes a short-lived, client-type/scope-bound pairing grant on the broker and writes its private `psst-pairing-v1` file. Place that file inside the existing sandbox (owner-only `0600`), then run:

```text
/psst-connect /absolute/private/path/opencode-pairing.json
```

The plugin generates and durably saves its own random credential before issuance, sends only the credential hash over verified HTTPS, and stores the issued credential and token-bound receipt privately. Neither pairing secret nor bearer token enters command arguments, chat, model input, URLs or logs. The helper uses system TLS trust; it does not disable certificate verification or accept a pairing-file CA override.

The private installation directory is `$XDG_STATE_HOME/psst/opencode/<project-and-session-hash>` (default `~/.local/state/psst/opencode/...`). Preserve it inside the sandbox to safely retry a lost enrollment response with the **same file and native session**. A different native session needs its own operator pairing grant; a redeemed grant cannot be reused to create another key. No control-plane UI or public signup service is installed.

`/psst-status` reports only a nonsecret credential ID and expiry. Expired or rejected credentials stop messaging and require explicit re-pairing; no silent credential replacement occurs. Disconnect before changing a live connection. Re-pairing always creates a fresh local broker identity/inbox and never imports another principal's pending messages.

New helper bundles carry `enrollment_receipt_file: "enrollment.json"`; that exact sibling receipt is mandatory and checked against the private token hash, broker and client type. Missing or corrupt receipt is a hard error, not a legacy fallback. Unmarked legacy bundles still work unchanged. The optional legacy environment mode may read an existing bundle but never performs enrollment automatically.

## After npm publication

The package is prepared as `@matuto-ai/opencode-broker-connector`. **A prepared package/workflow does not mean it has been published.** Once version `0.2.0` exists on npm, use this native OpenCode configuration instead of the local file:

```json
{"plugin": ["@matuto-ai/opencode-broker-connector@0.2.0"]}
```

OpenCode installs npm plugins automatically using Bun. Use the same native connect command (or optional legacy `PSST_CONFIG_FILE`); remove the duplicate local entry so the plugin does not load twice. See [publication](docs/publishing.md).
