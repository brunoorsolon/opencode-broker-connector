# Shared enrollment helper

Unmodified `reference/enrollment.mjs` from `matuto-ai/psst` commit `3e908e79966d886a02d372c103e31dec6e900c1a`, independently compared byte-for-byte with the remote committed source. Upstream PR #18 is pending review/merge; this commit pin is not a deployment or release claim.

SHA-256: `afeab00d7c2d6768d3537bd7c350e249768897bf81eff9b4ae9796f7c3f9dbe9`.

Runtime hash checked by `src/enrollment.mjs` before import. MIT license copied alongside. The existing pinned broker transport/runtime remains unchanged at its separate origin.

Source: https://github.com/matuto-ai/psst/blob/3e908e79966d886a02d372c103e31dec6e900c1a/reference/enrollment.mjs
Operator guide at that commit: https://github.com/matuto-ai/psst/blob/3e908e79966d886a02d372c103e31dec6e900c1a/docs/pairing-operator.md

## URL-only approval helper

`approval.mjs` is vendored byte-for-byte from `matuto-ai/psst` commit
`72f5d2d1b834e02cfb6b2f7dc11c6f1a55729344`, path `reference/approval.mjs`,
Git blob `8e6128c22835e66c0ab50aa15c27ff16d33e1169`, SHA-256
`a60c3a0ccd7deb50556586cd67841bb89a300ea3c7f1af3a91d437f856b7a2d5`.
This is the explicit broker PR #22 dependency, not a claim of a deployed release.
The connector checks the digest before importing it. The old enrollment helper
remains unchanged for legacy bundles/receipts.
