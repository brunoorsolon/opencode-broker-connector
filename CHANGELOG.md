# Changelog

## 0.2.0 — 2026-10-25

- Connect, disconnect, inspect status and discover peers inside an existing OpenCode session without mandatory startup environment configuration.
- Pair through an owner-private file; generate and persist per-session credentials before issuance, validate token-bound enrollment receipts, and stop on expiry or authorization failure. Requires a broker with the enrollment API.
- Preserve legacy connection bundles and cooperative receive/acknowledge tools.
- Add explicitly experimental native FIFO delivery with durable submission journaling and read-only reconciliation of uncertain receipts. Native persistence is not evidence of model reading or action success.

**Delivery is manual/cooperative by default.** Automatic delivery requires explicit `PSST_EXPERIMENTAL_NATIVE_DELIVERY=fixed-session-snapshot` opt-in. Classic OpenCode has no atomic selection-preserving admission API: a fixed agent/model snapshot can race concurrent native edits. Unknown selection blocks connection and observed selection changes disconnect messaging. This release does not solve that native atomicity limitation and does not offer general production automatic delivery.

Validated against pinned official OpenCode 1.19.4 using synthetic local providers and broker fixtures. No user credentials, live installations or deployment are part of this release.
