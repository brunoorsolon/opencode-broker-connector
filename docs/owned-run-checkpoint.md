# Owned-run work in progress (2026-10-23)

This feature-branch checkpoint preserves an unfinished, **not yet approved for
operator use** launcher for one fresh owned `opencode run --format json` process.
The prior cooperative factory remains the reviewed baseline.

- Preliminary isolated source/runtime evidence: official OpenCode 1.19.4,
  bundled Bun 1.4.4, native root `session.created` → `chat.message` → `dispose`,
  and the shared SQLite inbox primitives. The provider was a local deterministic
  fixture; no real model credentials or account was used.
- The new launcher/plugin is still receiving exact process-incarnation guards,
  real native-tool-loop tests, policy-preservation checks and independent review.
- Syntax checks at this checkpoint are not native certification. Existing CI
  currently covers the earlier factory tests, not the unfinished owned launcher.
- No existing TUI attachment, resume, background wakeup, native-consumption ACK,
  permission override, automatic approval, installation or deployment is claimed.

See the draft PR for the subsequent reviewed/tested checkpoint. Do not infer that
`run` process ownership alone proves an unrelated server or TUI session lifetime.

This historical WIP note describes commit `9eb4df888ae986e0c0a1589051358ba0dadaf73b`,
not later reviewed revisions. See [current owned-run documentation](owned-run.md)
and the draft PR for subsequent exact-process hardening and native test evidence.
