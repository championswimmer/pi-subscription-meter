# Add npm badges to README

- **Status:** in-progress
- **Date:** 2026-08-29
- **Owner:** agent

## Objective

Add Shields.io badges for the published npm package version and downloads to the README, and document the work plan and validation for the related pull request.

## Checklist

- [x] Review repository instructions and current README/package metadata.
- [x] Create a task plan in `.agents/plans/`.
- [ ] Add npm version and downloads badges to `README.md`.
- [ ] Validate the README changes and scan modified files for secrets.
- [ ] Update this plan to reflect completed work and open a pull request.

## Detailed implementation plan

1. Confirm the package name and current README structure so the badge URLs and links point to the correct npm package.
2. Insert concise Shields.io badges near the top of `README.md`, linking both badges to the npm package page and matching the existing flat-square style already used in the README.
3. Review the rendered markdown structure to ensure the badges appear in a sensible location and do not disrupt existing content.
4. Run the required validation for the touched files, including a secrets scan of modified files.
5. Update this plan checklist and status to match the final state, then prepare the pull request summary.

## Risks / questions

- The package must already exist on npm for the badges to resolve correctly; the README will still be correct if publication metadata updates later.
- Badge placement should stay minimal and avoid duplicating other project branding.

## Validation

- Review the changed markdown in `README.md`.
- Run the repository secret scan on modified files before committing.
