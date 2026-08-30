# Publish package version 0.1.0 to npm

- **Status:** blocked
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Prepare and publish version `0.1.0` of this package to npm, ensuring agent-only repo files are excluded from the published tarball, the lockfile is refreshed, and the matching git tag is pushed to GitHub.

## Checklist

- [x] Inspect current package metadata, lockfile state, and publish-related config.
- [x] Confirm whether version `0.1.0` is publishable; npm auth/scope remains blocked.
- [x] Exclude `.agents` and other agent-only files from the npm package via `.npmignore` or equivalent.
- [x] Update `package.json` version to `0.1.0` if needed. (It was already `0.1.0`.)
- [x] Run `npm install` to refresh the lockfile.
- [x] Validate the publish tarball contents.
- [x] Commit the publish-prep changes if needed.
- [x] Create and push the `v0.1.0` git tag.
- [ ] Publish version `0.1.0` to npm.
- [x] Record outcomes and any follow-up notes in this plan.

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

## Outcome summary

What succeeded:
- confirmed the package is already at version `0.1.0`
- removed agent-only files from the published package by:
  - removing `.agents` and `AGENTS.md` from `package.json.files`
  - adding `.npmignore` entries for `.agents/` and `AGENTS.md`
- ran `npm install` (no dependency or lockfile changes were needed)
- verified the publish tarball with `npm pack --dry-run`
- committed the publish-prep changes
- pushed `main`
- created and pushed git tag `v0.1.0`

What failed:
- `npm whoami` returned `401 Unauthorized`
- `npm publish --access public` returned `404 Not Found - PUT https://registry.npmjs.org/@championswimmer%2fpi-subscription-meter`

Interpretation:
- the repo is prepared correctly for publishing, but npm publishing is currently blocked by registry auth and/or ownership of the `@championswimmer` scope
- the package does not currently exist on npm, so the failure is not due to a duplicate version

Likely next step outside the repo:
- authenticate npm with an account that owns the `@championswimmer` scope, then rerun:
  - `npm whoami`
  - `npm publish --access public`
- if the intended npm scope is different from `@championswimmer`, update `package.json.name` before publishing a first release under that scope