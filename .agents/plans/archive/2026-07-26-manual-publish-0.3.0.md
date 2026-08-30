# Manually publish package version 0.3.0

- **Status:** blocked
- **Date:** 2026-07-26
- **Owner:** agent

## Objective

Manually publish the already tagged `0.3.0` package to npm, verify that the registry reflects the new version, and record the outcome.

## Checklist

- [x] Confirm the target package version to publish.
- [x] Verify npm authentication and publish prerequisites.
- [x] Preview the package contents that will be published.
- [x] Publish `0.3.0` to npm.
- [x] Verify npm registry state after publish.
- [x] Record the final outcome in this plan.

## Detailed implementation plan

1. Confirm the local package version is `0.3.0` and that the working tree state will not interfere with publishing.
2. Check npm authentication (`npm whoami`) and any publish prerequisites for the package.
3. Run a dry-run packaging step (`npm pack --dry-run`) to inspect the files that npm will include.
4. Execute a manual publish command for the package.
5. Query npm registry metadata to confirm `0.3.0` is published and, if applicable, assigned to the `latest` dist-tag.
6. Update this plan with command outcomes, validation notes, and any follow-up actions.

## Risks / questions

- Publishing requires valid npm credentials in the current environment.
- If npm enforces 2FA or other account protections, the publish command may prompt or fail.
- Registry propagation can take a short time after a successful publish.

## Validation

- `node -e "console.log(require('./package.json').version)"`
- `npm whoami`
- `npm pack --dry-run`
- `npm publish`
- `npm view pi-subscription-meter version dist-tags --json`

## Outcome summary

- Confirmed local package version is `0.3.0`.
- `npm whoami` failed with `E401 Unauthorized`, indicating the current npm auth is not valid for identity lookup.
- `npm pack --dry-run` succeeded and showed the expected `pi-subscription-meter@0.3.0` tarball contents.
- `npm publish` attempted to publish to `https://registry.npmjs.org/` but failed with `E404 Not Found - PUT https://registry.npmjs.org/pi-subscription-meter`.
- Registry verification still shows `latest: 0.2.1`; `0.3.0` has not been published.
- Current environment has an npm token configured (`~/.npmrc` and `NPM_TOKEN` present), but it appears invalid or insufficient for this package publish.
