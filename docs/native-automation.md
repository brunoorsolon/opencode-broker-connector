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
