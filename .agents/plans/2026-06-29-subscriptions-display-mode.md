# Subscriptions usage display mode setting

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Add a persisted `/subscriptions` setting that lets the user choose whether progress bars are rendered as quota **used** or quota **remaining**. The setting should live alongside provider enablement, be editable from the existing settings overlay, and immediately update the main subscriptions dialog.

## Checklist

- [x] Review the current settings schema, settings dialog, and subscriptions dialog render path.
- [x] Extend persisted settings with a display-mode field and safe defaults for existing users.
- [x] Add a display-mode control to the settings overlay.
- [x] Thread the selected display mode into the subscriptions dialog.
- [x] Update progress-bar/status rendering so bars can represent either used or remaining quota.
- [x] Validate with `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect the current settings storage module and provider settings dialog to find the cleanest place to add a global `displayMode` option without breaking provider toggling.
2. Extend `SubscriptionMeterSettings` with a string union such as `"used" | "remaining"`, default it to `"used"`, and normalize loaded JSON so older settings files continue to work.
3. Update the settings overlay to include a top-level setting item for display mode, while keeping the provider enable/disable items below it.
4. Update the overlay callback wiring in `src/extensions/core/index.ts` so both enabled providers and display mode are saved and immediately reflected in the main dialog.
5. Extend `SubscriptionsDialog` with a display-mode option and render logic that:
   - fills the bar by `usedPercent` when mode is `used`
   - fills the bar by `100 - usedPercent` when mode is `remaining`
   - updates the right-hand status label to match the chosen mode
   - keeps `pending` behavior unchanged when no live percentage exists
6. Re-run typecheck and update this plan with completed checklist items and brief completion notes.

## Risks / questions

- The existing data model stores only `usedPercent`, so remaining mode should be derived from that rather than adding a second percentage field.
- The user phrased the toggle as “pending vs used”, but the actual display semantics needed are “remaining vs used”. The implementation should use the semantically correct setting name in code/UI.
- Existing settings files should continue working with no migration step beyond defaulting missing `displayMode` values.

## Validation

- `npm run typecheck` ✅
- Verify the settings overlay shows a display-mode selector in addition to provider toggles.
- Verify switching display mode immediately updates the currently open subscriptions dialog.
- Verify windows with no `usedPercent` still show `pending` rather than a computed percentage.
- Verify the settings JSON round-trips with both `enabledProviders` and `displayMode`.

## Completion notes

- Extended `src/extensions/core/settings.ts` with persisted `displayMode` support and backward-compatible defaulting for older settings files.
- Added a display-mode selector to `src/extensions/core/ui/provider-settings-dialog.ts` above the provider toggles.
- Updated `src/extensions/core/index.ts` so settings changes immediately save and refresh both enabled tabs and display-mode rendering.
- Updated `src/extensions/core/ui/subscriptions-dialog.ts` so bars and labels can render either `% used` or `% remaining`, while keeping `pending` unchanged when no live value exists.