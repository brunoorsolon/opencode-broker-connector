# Vendored runtime

Source: https://github.com/matuto-ai/psst/tree/ba2219cd87a1feac23e01b23d2c2b3d3bdd65359
Seven runtime/protocol files are copied byte-for-byte and verified by src/reference-pin.mjs before import. The MIT license is retained. Connector cooperative read acknowledgments are implemented separately in src/cooperative-inbox.mjs, not by changing the pinned runtime or inventing native receipts.
Test-only broker fixtures are copied from the same commit into test/broker-fixture; they are excluded from the npm package. No broker daemon is bundled in the installable runtime.
