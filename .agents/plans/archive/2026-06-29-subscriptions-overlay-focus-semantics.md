# Subscriptions overlay focus semantics

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Adjust the `/subscriptions` floating overlay so it keeps keyboard focus by default while still allowing the Pi agent session and tool activity to continue rendering underneath it. The overlay should capture Tab, refresh, settings, and Esc itself, but it should no longer auto-release focus to the underlying conversation.

## Checklist

- [x] Review the current overlay open/toggle behavior in `src/extensions/core/index.ts`.
- [x] Remove the auto-unfocus behavior when the subscriptions overlay opens.
- [x] Update repeated `/subscriptions` behavior so it re-focuses the existing overlay instead of toggling release.
- [x] Update overlay help text and notifications to describe the new focused-overlay semantics.
- [x] Validate with `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect the current `/subscriptions` overlay lifecycle in `src/extensions/core/index.ts`, especially `onHandle`, repeated command handling, and the current user notifications.
2. Keep the floating overlay architecture and compact width unchanged, but stop calling `OverlayHandle.unfocus()` on open so the overlay remains the active keyboard target.
3. Change repeated `/subscriptions` invocation behavior so it no longer toggles focus/release. If the overlay already exists, focus it if needed; if it is already focused, leave it focused and optionally notify the user.
4. Update `src/extensions/core/ui/subscriptions-dialog.ts` footer text so it no longer mentions `focus/release`, and instead describes `/subscriptions close`, settings, refresh, and tab switching.
5. Re-run `npm run typecheck` and update this plan to reflect the final behavior.

## Risks / questions

- This relies on Pi continuing to render agent/tool progress underneath a focused overlay, which should work because the custom overlay is opened asynchronously rather than awaited.
- If users later want an explicit “release focus” behavior again, it should be added as a separate command or keybinding rather than overloading `/subscriptions`.

## Validation

- `npm run typecheck` ✅
- Verify `/subscriptions` opens as a focused floating overlay.
- Verify Tab, arrow keys, `r`, `s`, and Esc are handled by the overlay while it is open.
- Verify agent/tool progress can still continue underneath the overlay.
- Verify `/subscriptions close` still dismisses the overlay.

## Completion notes

- Updated `src/extensions/core/index.ts` so the subscriptions overlay no longer auto-unfocuses on open.
- Changed repeated `/subscriptions` behavior to keep the dialog focused instead of toggling focus release.
- Updated user-facing notifications to explain that the dialog keeps keyboard focus while background agent/tool progress can continue underneath.
- Updated `src/extensions/core/ui/subscriptions-dialog.ts` footer copy to remove the old focus/release hint.
