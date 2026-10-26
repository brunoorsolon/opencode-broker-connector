# Native automation feasibility (OpenCode 1.19.4)

## Production boundary

Normal install/connect/pairing is cooperative. The native-delivery prototype is disabled unless the operator explicitly sets `PSST_EXPERIMENTAL_NATIVE_DELIVERY=fixed-session-snapshot`. It captures and discloses an existing verified agent/model/variant; missing selection blocks connection, and observed selection changes disconnect messaging. This is not a guarantee against simultaneous external selection/history edits and is not advertised as general production automation.

## Primary-source findings

- [Classic prompt implementation](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/opencode/src/session/prompt.ts): missing `agent` resolves the default agent, not necessarily the current session selection. `createUserMessage` can update the session agent/model before the `chat.message` hook. Explicitly forwarding a verified snapshot prevents omission/default drift but supplies no compare-and-submit revision check.
- [Classic runner](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/opencode/src/effect/runner.ts): model loops are serialized. An idle observation is not an exclusive lease over all human/agent inputs or history/selection mutations.
- [HTTP handler](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts): `prompt_async` forks work and returns 204 before durable message proof. The prototype journals its exact target and reads back session/message/part/text/provenance/agent/model/variant; delayed proof is reconciled read-only, never by resubmission.
- [New core API](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/core/src/session.ts) exposes durable queued admission without an agent/model input. However [schema/projector](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/core/src/session/projector.ts) and [tables](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/core/src/session/sql.ts) distinguish classic `message`/`part` from new `session_message`/`session_input` histories.

The actual official-CLI regression creates a classic Plan-mode conversation with two messages. `/api/session/{id}` sees the identity/selection, but `/api/session/{id}/context` and `/history` return empty histories. Therefore the connector does not submit to the separate engine or silently create a replacement conversation. No writes to OpenCode's database, internal module injection, TUI keystrokes or permission overrides are used; the connector only maintains its own private delivery journal.

## Unsent upstream feature proposal

**Draft only — not posted as an issue or sent externally.**

Request a public plugin/SDK operation for durable, idempotent queued input into the *existing native conversation engine*, with:

1. Native atomic preservation of the current agent/model/variant, or an expected selection/context revision that rejects before any state mutation.
2. Exact stable admission ID and a read-only receipt lookup; repeated identical input is idempotent and conflicts are explicit.
3. Queue/idle semantics that do not interrupt foreground work, clear revert state, bypass permissions, or switch conversation engines.
4. Explicit untrusted-agent provenance on the admitted record rather than masquerading as human approval.
5. Lifecycle fencing across deletion, revert and compaction, plus documentation of whether admission proves persistence, model input delivery or neither.

This could be a compatibility bridge to the new durable queue only if it preserves the actual existing CLI history, policy and runner. Until supported and verified, default cooperative delivery is the honest production behavior.

## Fresh admission investigation for URL-only setup (2026-10-26)

The pinned official CLI regression `test/native-v2-compat.test.mjs` now reproduces
an actual stale-selection race: read Plan/model A; submit a human message changing
to Build/model B; call classic `prompt_async` with the previously observed
Plan/model A. The native session switches back to Plan/model A rather than rejecting
the stale request. Omitting `agent` instead chooses the default Build agent, not
the existing Plan selection. Both checks execute in the real 1.19.4 host against
a synthetic local provider, without a production account.

Fresh source inspection at `v1.19.4` confirms:

- `session/prompt.ts:635–690`: `createUserMessage` resolves the default agent when
  omitted and calls `sessions.setAgentModel` before admission arbitration.
- `session/prompt.ts:1046–1072`: message/parts are persisted and revert cleanup
  occurs before the model loop. `noReply` only skips that loop, not these mutations.
- `effect/runner.ts:120–146`: `ensureRunning` serializes/joins model execution;
  it does not reject a stale prompt before session/selection mutation.
- `server/routes/instance/httpapi/handlers/session.ts:295–327`: synchronous and
  asynchronous routes invoke the same prompt implementation; async forks and
  returns before receipt proof. Busy rejection elsewhere applies to shell work,
  not an atomic selection-preserving prompt queue.
- Supported TUI APIs expose prompt set/reset/submit and command dispatch, not a
  durable idempotent peer-input queue with a selection revision. Using those
  methods for delivery would alter the user's draft or invoke the same unsafe
  admission path. They are not used for peer delivery.

Accordingly automatic idle model receive is **still blocked by the supported
classic host API**, not enabled by the approval feature or the identity handshake.
The separate v2 engine still lacks this classic conversation's history. Neither a
successful setup nor a TLS/PTY fixture closes this acceptance gate.

## Local idle identity attachment

The server publishes a random, nonsecret per-plugin-incarnation context marker in
its existing `psst-status` command template through the supported config hook. The
TUI reads `api.state.config` and `api.route.current`, then emits a short-lived
owner-private hint under the container's temporary directory. The server reads
only its own incarnation directory, verifies the exact native session and project
through `session.get`, and binds a separate broker inbox. Hints expire after five
seconds, route changes retire hint-owned bindings, and disposal removes them.
This is installation-independent local IPC, not enrollment authority, a native
history scan, model command, input injection, or a substitute for atomic delivery.
Remote TUI/server filesystems cannot use this handshake.
