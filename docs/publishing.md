# Package publication

Package name: `opencode-broker-connector`. The npm workflow follows the owner's existing release-triggered trusted-publishing pattern, with version verification, full native tests and package audit before publication.

1. Review and merge the feature PR.
2. Bootstrap the package under an npm account authorized for this package if it does not exist yet. Account creation, credentials and first publication are operator actions, not performed by the connector.
3. Configure npm's GitHub Actions trusted publisher for owner `brunoorsolon`, repository `opencode-broker-connector`, workflow `npm-publish.yml`. If the repository moves, update package metadata and trusted-publisher settings together.
4. Create a GitHub release whose tag exactly matches `v` + package.json version (first `v0.1.0`).
5. The action runs syntax, tests including pinned actual CLI, package inspection, then `npm publish --access public --provenance` using OIDC. No long-lived npm token is stored in the workflow.
6. Confirm npm has the exact version before recommending npm installation. Failed publishing is not repaired by silently changing a version or recreating a tag.

`id-token: write` is limited to the release workflow. This repository does not configure a trusted publisher, generate credentials, publish, merge or deploy automatically on ordinary pushes/PRs. Those events run read-only CI checks only.

Before npm publication, the local-file installation in README works directly from the feature branch after review. No unpublished dependency is required.
