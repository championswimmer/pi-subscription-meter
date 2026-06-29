# Rename npm package to unscoped `pi-subscription-meter`

- **Status:** in progress
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Move the published package away from the `@championswimmer` scope and publish it as the unscoped package `pi-subscription-meter`, while cleaning up or deprecating the scoped package as appropriate.

## Checklist

- [ ] Inspect current package metadata and npm publish state for both scoped and unscoped package names.
- [ ] Confirm whether `pi-subscription-meter` is available on npm.
- [ ] Determine whether the already-published scoped package can be unpublished or should be deprecated instead.
- [ ] Update local package metadata from `@championswimmer/pi-subscription-meter` to `pi-subscription-meter`.
- [ ] Refresh lockfile/package metadata if needed.
- [ ] Verify the publish tarball still excludes agent-only files.
- [ ] Commit the rename changes.
- [ ] Publish `pi-subscription-meter` to npm.
- [ ] Clean up the scoped package via unpublish or deprecate.
- [ ] Verify the final npm state and record outcomes.

## Detailed implementation plan

1. Check npm registry state for both `@championswimmer/pi-subscription-meter` and `pi-subscription-meter`, including current versions and ownership/availability.
2. Check npm policy constraints by attempting or evaluating whether the scoped package can be unpublished; if unpublish is blocked or undesirable, use `npm deprecate` with a message pointing to the new package name.
3. Update `package.json` and lockfile metadata to use the unscoped name `pi-subscription-meter`.
4. Re-run `npm install` if needed so `package-lock.json` matches the new package name.
5. Run `npm pack --dry-run` to confirm the publish contents are still correct and agent-only files remain excluded.
6. Commit the rename/publish-prep changes.
7. Publish the unscoped package to npm, likely at version `0.1.0` if available for that name.
8. Remove or deprecate the scoped package depending on what npm permits.
9. Verify the final registry state for both package names and document the result.

## Risks / questions

- The unscoped name `pi-subscription-meter` may already be taken on npm.
- The scoped package may not be eligible for unpublish depending on npm timing/policy, in which case deprecation is the safer fallback.
- Publishing may again require OTP/2FA, which might require manual intervention.
- Reusing version `0.1.0` is only possible if that version does not already exist for the unscoped package.

## Validation

- `npm view @championswimmer/pi-subscription-meter version dist-tags --json`
- `npm view pi-subscription-meter version dist-tags --json`
- `npm install`
- `npm pack --dry-run`
- `npm publish`
- `npm unpublish` or `npm deprecate`
- final `npm view` checks for both names