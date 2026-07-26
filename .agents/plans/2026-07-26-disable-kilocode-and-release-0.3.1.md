# Temporarily disable Kilo Code and prepare v0.3.1

- Status: completed
- Objective: Guard the Kilo Code provider behind a hardcoded disabled flag so it is fully hidden for now, then prepare a new patch release/tag to ship that change without publishing.

## Checklist

- [x] Read repo instructions and planning guidance
- [x] Inspect current Kilo Code integration and release state
- [x] Add/update a plan for temporarily disabling Kilo Code
- [x] Implement a hardcoded feature flag that keeps Kilo Code disabled for now
- [x] Ensure saved/default provider settings cannot enable the disabled provider
- [x] Bump package version for a patch release
- [x] Validate with typecheck
- [x] Commit the release changes
- [x] Create the release tag
- [x] Update this plan with final results

## Detailed implementation plan

1. Add this plan before code changes and capture the intended scope: temporary deprecation of Kilo Code plus a patch release.
2. Inspect the provider registry/settings flow to identify the smallest safe place to guard Kilo Code so it disappears from defaults, settings, and runtime loading.
3. Implement a provider feature flag (hardcoded disabled for now) and use it to exclude Kilo Code from the exported provider list used by the registry and settings normalization.
4. Keep the Kilo implementation source in the repo for future re-enablement, but make sure the disabled flag prevents accidental exposure and runtime execution.
5. Bump the package version from `0.3.0` to `0.3.1` and update lockfile metadata consistently.
6. Run `npm run typecheck` to verify the release candidate.
7. Commit the changes with a focused release message and create tag `v0.3.1` locally.
8. Update this plan with what changed, validation results, and any follow-up notes for manual publish.

## Risks / questions

- The current runtime error may still exist elsewhere, but disabling Kilo Code should prevent this provider from contributing to `/subscriptions` failures for now.
- Existing users may already have `kilocode` saved in settings; the normalization path should drop it once the provider is absent from the exported registry.
- This should remain clearly temporary so Kilo Code can be re-enabled later without losing the implementation work.

## Validation

- `npm run typecheck`
- Inspect provider registry/default settings behavior to confirm Kilo Code is excluded
- Confirm local git tag `v0.3.1` exists after release prep

## Progress notes

- Added a temporary `ENABLE_KILO_CODE_PROVIDER = false` guard in `src/extensions/core/providers/index.ts` so Kilo Code is excluded from the exported provider registry.
- Also flipped `enabledByDefault` to `false` in `src/extensions/core/providers/kilocode.ts` as a secondary safeguard.
- Because `subscriptionProviders` now omits `kilocode`, the settings normalization path in `src/extensions/core/settings.ts` will drop any previously saved `kilocode` entry.
- Bumped package metadata from `0.3.0` to `0.3.1` in `package.json` and `package-lock.json`.
- Validation completed: `npm run typecheck` passed on 2026-07-26.
- Created the release commit with message `release: v0.3.1`.
- Created local annotated tag `v0.3.1` pointing at the release commit.
