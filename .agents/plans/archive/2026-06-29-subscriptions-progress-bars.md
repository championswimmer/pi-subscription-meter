# Subscriptions dialog progress-bar UI

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Refocus the `/subscriptions` dialog away from long explanatory text and toward compact visual usage meters. Add a reusable generic progress-bar component that renders filled rectangular cells for completed usage, lightly shaded cells for remaining capacity, and optional custom notch markers at configured percentage boundaries such as 25%, 50%, and 75%.

## Checklist

- [x] Review the current subscriptions dialog layout and identify verbose sections to remove or compress.
- [x] Design a reusable progress-bar renderer that supports configurable width, percentage, and custom notch percentages.
- [x] Add a compact usage-window data shape for provider scaffolds so the dialog can render progress bars instead of notes-heavy text.
- [x] Update provider scaffold definitions with initial bar-oriented placeholder windows suitable for the current non-fetching state.
- [x] Refactor the subscriptions dialog to prioritize provider name + compact progress rows and reduce auth/notes copy.
- [x] Validate with `npm run typecheck`.
- [x] Update this plan with completed status and what changed.

## Detailed implementation plan

1. Inspect `src/extensions/core/ui/subscriptions-dialog.ts` and provider types to see how provider metadata is currently rendered and where a progress-bar abstraction can plug in.
2. Create a reusable UI helper/component under `src/extensions/core/ui/` that accepts:
   - total bar width in cells
   - progress percent or fraction
   - filled and empty cell styling
   - an optional list of notch percentages
   - optional clamping/deduplication so invalid percentages do not break rendering
3. Render the bar using solid block-style filled cells and lightly shaded empty cells so the meter is readable in a terminal. Use distinct notch cells that still preserve whether that position is filled or empty.
4. Extend the provider scaffold contract with a compact `usageWindows`/`previewWindows` array so each provider can supply a small set of rows to render, including label, percent used, and notch configuration.
5. Update existing scaffold providers to provide a small set of representative windows and concise descriptions, while avoiding large auth and notes sections in the dialog.
6. Refactor `SubscriptionsDialog` so the active tab shows:
   - provider title
   - very short status line if needed
   - one progress row per usage window
   - minimal footer controls
   and removes the long-form Auth / Usage source / Notes blocks from the main panel.
7. Run `npm run typecheck`, fix any typing issues, and update this plan to mark the completed checklist items.

## Risks / questions

- Because live fetching is not implemented yet, the initial progress rows may need to be clearly scaffolded or placeholder-oriented so users do not mistake them for live values.
- Notches can only be approximate at terminal cell resolution; the implementation should document or encode them as nearest-cell markers.
- ANSI color styling and notch glyph choices must remain legible across different terminal themes.

## Validation

- `npm run typecheck` ✅
- Verify the dialog no longer spends most of its space on auth and note text.
- Verify the progress-bar helper supports custom notch percentages such as `[25, 50, 75]`.
- Verify filled, empty, and notch cells remain visually distinct in the rendered output.
- Verify enabled provider tabs still render correctly after the provider type changes.

## Completion notes

- Added `src/extensions/core/ui/progress-bar.ts` as a reusable progress-bar renderer with configurable width and custom notch percentages.
- Extended provider scaffolds with compact `usageWindows` rows so the dialog can render meter-first provider content.
- Refactored `src/extensions/core/ui/subscriptions-dialog.ts` to remove the verbose Auth / Usage source / Notes sections from the main panel.
- Scaffold usage rows currently render as `pending` until live quota fetching is implemented.