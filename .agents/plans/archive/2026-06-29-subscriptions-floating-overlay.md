# Subscriptions floating overlay layout

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Convert `/subscriptions` from a full-width blocking custom view into a compact floating overlay that stays visually on top of the Pi chat without taking over the whole conversation area. The overlay should be narrow, use 20-character progress bars, and allow the normal conversation/editor underneath to continue when the overlay is not focused.

## Checklist

- [x] Review the current `/subscriptions` command lifecycle and how it uses `ctx.ui.custom()`.
- [x] Switch the main subscriptions UI to a floating overlay instead of a full-width replacement view.
- [x] Make the overlay non-blocking for the underlying conversation by releasing focus when appropriate.
- [x] Add simple command behavior for focusing/releasing/closing an already-open subscriptions overlay.
- [x] Reduce the dialog layout width and clamp progress bars to 20 cells.
- [x] Trim the main dialog content so the compact overlay remains readable.
- [x] Validate with `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Read the Pi TUI overlay docs and examples to confirm the supported focus model for floating overlays, especially `overlay: true`, `onHandle`, and `OverlayHandle.focus()/unfocus()`.
2. Refactor the `/subscriptions` command so it opens the main UI as an overlay with explicit sizing/anchor options rather than as a blocking full-screen-ish custom component.
3. Store the overlay handle and close callback at module scope so repeated `/subscriptions` invocations can reuse the existing overlay instead of stacking duplicates.
4. Make the default open behavior passive/non-blocking by releasing overlay focus after creation so the editor/chat regains input underneath the overlay.
5. Add minimal command semantics:
   - `/subscriptions` opens the overlay if closed
   - `/subscriptions` focuses it if already open but passive
   - `/subscriptions` releases it if already focused
   - `/subscriptions close` closes it explicitly
6. Tighten `SubscriptionsDialog` rendering so it fits a narrow floating panel: cap effective width, reduce footer copy, remove verbose explanatory sections, and clamp progress bars to 20 characters.
7. Run `npm run typecheck` and update this plan with final notes.

## Risks / questions

- A passive overlay cannot receive keyboard input until it is focused again, so the command needs a simple re-focus path.
- Compact width means some long provider names and status strings will truncate; this is acceptable if the essential quota bars remain readable.
- Releasing overlay focus should allow the editor/chat underneath to continue, but we should keep the close path explicit as well (`/subscriptions close`).

## Validation

- `npm run typecheck` ✅
- Verify `/subscriptions` opens as a floating overlay rather than replacing the main chat region.
- Verify the overlay is visibly narrow and progress bars are capped at 20 cells.
- Verify the user can continue interacting with the conversation/editor underneath after the overlay opens.
- Verify `/subscriptions` can focus an existing passive overlay and `/subscriptions close` dismisses it.

## Completion notes

- Updated `src/extensions/core/index.ts` so `/subscriptions` now opens as a top-right floating overlay instead of a blocking full-width custom view.
- Added overlay-handle reuse semantics: rerunning `/subscriptions` focuses or releases the existing overlay, and `/subscriptions close` dismisses it explicitly.
- Released overlay focus immediately on open so the normal conversation/editor can continue underneath while the panel stays visible.
- Tightened `src/extensions/core/ui/subscriptions-dialog.ts` to a compact width, capped bars at 20 cells, and removed verbose bottom sections so the floating panel stays concise.