# Subscriptions notch visibility settings

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Add subscription settings that independently control whether progress bars show threshold notches and whether they show a dynamic `now` notch. Threshold marks should use the compact 50% and 75% reference points, and in `remaining` mode they should project as 50% left and 25% left.

## Checklist

- [x] Review the current settings schema, settings overlay, and subscriptions notch rendering path.
- [x] Add persisted settings for threshold-notch visibility and now-notch visibility with backward-compatible defaults.
- [x] Add settings UI controls for both notch toggles.
- [x] Update subscriptions rendering to conditionally show threshold notches and the current-time notch.
- [x] Ensure threshold notches project correctly in both `used` and `remaining` display modes.
- [x] Ensure live re-rendering still occurs when the `now` notch is enabled, even in absolute reset-time mode.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect the current settings model, provider settings dialog, and subscriptions dialog notch logic to identify where the two new controls should be threaded.
2. Extend `SubscriptionMeterSettings` with two booleans for threshold-notch visibility and current-time-notch visibility, and normalize missing values from older saved config files to sensible defaults.
3. Update the subscription settings overlay to expose two independent toggles, keeping the wording short and clear.
4. Refactor the subscriptions dialog notch-building logic so it composes:
   - static threshold notches filtered to the desired 50% / 75% reference points
   - an optional dynamic `now` notch derived from `pacePercent`
5. Project both threshold and `now` notches into the active display mode, so `remaining` mode shows mirrored positions such as 50% left and 25% left.
6. Update the dialog’s live ticker logic so it runs whenever either relative reset text or the `now` notch requires continuous updates.
7. Run `npm run typecheck` and update this plan with the final implementation notes.

## Risks / questions

- Existing provider window definitions contain mixed notch arrays like `[25, 50, 75]` and `[50, 75, 90]`; the dialog should avoid surfacing the unwanted 25% and 90% marks after this change.
- The `now` notch currently depends on `pacePercent`, so rows without time-window pacing data should simply omit it rather than inventing one.
- The settings should preserve current behavior by default unless the user explicitly turns one of the notch layers off.

## Validation

- `npm run typecheck`
- Verify the settings overlay shows two separate notch-related controls.
- Verify threshold notches render only at 50% and 75% in `used` mode.
- Verify threshold notches render as 50% left and 25% left in `remaining` mode.
- Verify the dynamic `now` notch can be toggled independently of threshold notches.
- Verify the `now` notch still updates over time when reset-time display is set to `absolute`.

## Completion notes

- Added persisted `showThresholdNotches` and `showNowNotch` settings with backward-compatible boolean normalization and default-on behavior.
- Added two settings overlay controls: `50/75 marks` and `Now mark`.
- Updated the subscriptions dialog to build threshold notches from the existing provider notch arrays, but filter them down to only 50% and 75% reference points.
- Projected both threshold and `now` notch positions into `remaining` mode so they mirror as left-side capacity markers.
- Replaced the reset-only ticker with a shared live-update ticker so the `now` notch keeps moving even when reset times are shown in absolute mode.
