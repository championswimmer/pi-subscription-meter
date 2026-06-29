# Publish package version 0.1.0 to npm

- **Status:** in progress
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Prepare and publish version `0.1.0` of this package to npm, ensuring agent-only repo files are excluded from the published tarball, the lockfile is refreshed, and the matching git tag is pushed to GitHub.

## Checklist

- [ ] Inspect current package metadata, lockfile state, and publish-related config.
- [ ] Confirm npm auth is available and verify whether version `0.1.0` is publishable.
- [ ] Exclude `.agents` and other agent-only files from the npm package via `.npmignore` or equivalent.
- [ ] Update `package.json` version to `0.1.0` if needed.
- [ ] Run `npm install` to refresh the lockfile.
- [ ] Validate the publish tarball contents.
- [ ] Commit the publish-prep changes if needed.
- [ ] Create and push the `v0.1.0` git tag.
- [ ] Publish version `0.1.0` to npm.
- [ ] Record outcomes and any follow-up notes in this plan.

## Detailed implementation plan

1. Inspect `package.json`, `package-lock.json`, and any existing `.npmignore`/`files` config to understand the current publish shape.
2. Verify npm CLI auth (`npm whoami`) and check whether the package/version already exists in the registry.
3. Add or update `.npmignore` so `.agents/`, `AGENTS.md`, and other agent-only artifacts are excluded from the package tarball while keeping required source/docs.
4. Update the package version to `0.1.0` if it is not already set, then run `npm install` to refresh the lockfile.
5. Run `npm pack --dry-run` (or equivalent) to verify the tarball contents before publishing.
6. Commit any required publish-prep changes if the working tree is dirty after the packaging updates.
7. Create the annotated git tag `v0.1.0` and push it to `origin`.
8. Publish the package to npm with the appropriate access level if required.
9. Update this plan with the final result, including whether the publish succeeded and the exact tag/version pushed.

## Risks / questions

- Version `0.1.0` may already exist on npm, in which case publish will fail and we may need to stop or ask for a different version.
- The repository may include files needed at runtime that should not be accidentally filtered by `.npmignore`.
- npm publish may require 2FA or account-specific access not available non-interactively.
- Tag creation may fail if `v0.1.0` already exists locally or remotely.

## Validation

- `npm whoami`
- `npm install`
- `npm pack --dry-run`
- `git status`
- `git tag --list v0.1.0`
- `npm publish` success output