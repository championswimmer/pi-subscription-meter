# Subscriptions reset-time display setting

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Add a persisted `/subscriptions` setting that controls whether usage-window reset times are shown as absolute local time or as relative time remaining. Relative mode should show only the two largest non-zero units (`1d 02h`, `02h 04m`, or `03m 08s`), while absolute mode should show the reset time in the user’s current timezone.

## Checklist

- [x] Review the current settings schema, settings overlay, and subscriptions window detail rendering.
- [x] Extend persisted settings with a reset-time display mode and backward-compatible defaults.
- [x] Add a reset-time display selector to the settings overlay.
- [x] Refactor usage-window data so providers can supply reset timestamps separately from static detail text.
- [x] Update subscriptions rendering to show reset info in either absolute or relative form.
- [x] Adjust implemented providers that currently bake reset text into detail labels.
- [x] Validate with `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect the existing `SubscriptionMeterSettings` shape and the settings overlay item list to identify the cleanest place to add a global `resetTimeDisplay` option without disturbing the existing provider enablement and usage display mode controls.
2. Extend `src/extensions/core/settings.ts` with a new string union such as `"absolute" | "relative"`, default it sensibly, and normalize loaded JSON so older settings files continue working without migration.
3. Update `src/extensions/core/ui/provider-settings-dialog.ts` so the overlay includes a reset-time display selector alongside the existing display-mode selector and provider toggles.
4. Thread the selected reset-time setting through `src/extensions/core/index.ts` into `SubscriptionsDialog`, mirroring how the existing display-mode setting is saved and applied live.
5. Refine `SubscriptionUsageWindowDefinition` so reset timestamps can be represented structurally instead of being hard-coded into provider-specific `detailLabel` strings. Keep existing non-time detail text separate from the renderer-generated reset text.
6. Update implemented providers (`openai-codex`, `github-copilot`, and `openrouter`) to populate the new reset timestamp field and remove duplicated absolute/relative reset wording from their detail strings.
7. Update `src/extensions/core/ui/subscriptions-dialog.ts` to format reset text according to the setting:
   - absolute mode: current local timezone time/date string
   - relative mode: two largest units only, choosing day+hour, hour+minute, or minute+second
8. Run `npm run typecheck`, update the checklist and completion notes, and document any behavior caveats discovered during implementation.

## Risks / questions

- Existing providers currently embed reset wording directly in `detailLabel`, so the refactor should avoid duplicated phrases like both `2h left` and `resets ...` appearing together.
- Some usage windows do not have real reset timestamps; those rows should keep their existing static detail text and only show reset UI when a concrete `Date` is available.
- Relative labels should remain stable and readable for sub-minute windows, so seconds need to be supported even though most current providers use longer windows.

## Validation

- `npm run typecheck`
- Verify the settings overlay shows a reset-time display selector.
- Verify switching the setting immediately updates the open subscriptions dialog.
- Verify relative labels render only two largest units: `d+h`, `h+m`, or `m+s`.
- Verify absolute labels render in local time rather than UTC.
- Verify providers with no reset timestamp continue showing their existing detail labels unchanged.

## Completion notes

- Added persisted `resetTimeDisplayMode` settings state with backward-compatible normalization and a default of `relative`.
- Added a `Reset time` selector to the subscription settings overlay and wired live updates into the main subscriptions dialog.
- Extended `SubscriptionUsageWindowDefinition` with `resetAt?: Date` so reset formatting is owned by the renderer instead of provider-specific strings.
- Updated the subscriptions dialog to render reset timestamps as either local absolute time or compact relative countdown text, with a 1-second live ticker in relative mode.
- Updated OpenAI Codex, GitHub Copilot, and OpenRouter provider adapters to populate `resetAt` and keep only non-reset detail text in `detailLabel`.
