# Subscriptions dialog border alignment

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Fix the compact `/subscriptions` floating dialog border width so the top and bottom edges align exactly with the content rows and right border. The box should render as a visually correct rectangle with no 2-character overhang.

## Checklist

- [x] Review the current width math in `src/extensions/core/ui/subscriptions-dialog.ts`.
- [x] Fix the border/content width calculation so all rendered rows have matching total width.
- [x] Validate with `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect how `safeWidth`, `innerWidth`, `contentWidth`, and border rendering currently interact in `SubscriptionsDialog.render()`.
2. Adjust the width math so the horizontal border fill uses the same total width basis as the bordered content rows.
3. Keep the compact overlay width and 20-cell bar cap unchanged.
4. Run `npm run typecheck` and update this plan with completion notes.

## Risks / questions

- The dialog uses ANSI-colored text, so width math must continue to rely on `truncateToWidth`/`visibleWidth` for content rows.
- The fix should only correct border geometry, not expand the overlay beyond its current compact footprint.

## Validation

- `npm run typecheck` ✅
- Verify the top and bottom borders align with the content rows and right border.
- Verify the dialog remains compact and progress bars stay capped at 20 cells.

## Completion notes

- Updated `src/extensions/core/ui/subscriptions-dialog.ts` width math so the total dialog width is computed once and the top/bottom borders use the same content width basis as the bordered rows.
- Preserved the existing compact overlay sizing and 20-cell progress-bar cap while removing the 2-character border overhang.
