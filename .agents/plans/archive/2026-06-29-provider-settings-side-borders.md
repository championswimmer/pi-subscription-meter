# Provider settings side borders

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Add visible left and right borders to the subscription settings overlay so it renders as a complete box inside `/subscriptions`.

## Checklist

- [x] Review the current provider settings dialog render path.
- [x] Wrap the settings dialog output with left/right borders while preserving title, list, and footer layout.
- [x] Keep top/bottom border rendering visually consistent with the new side borders.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect `src/extensions/core/ui/provider-settings-dialog.ts` to confirm the dialog currently relies on `DynamicBorder` lines and lacks manual side-border wrapping.
2. Update the dialog render path so the interior content is rendered at a slightly narrower width and then wrapped in accent-colored vertical borders.
3. Replace the top and bottom border lines with matching boxed borders so the full frame is visually consistent.
4. Run `npm run typecheck` and document the final border behavior in this plan.

## Risks / questions

- The side-border wrapper must account for ANSI width correctly so the right border stays aligned.
- The settings list already manages its own truncation, so the wrapper should reduce inner width before rendering rather than clipping after the fact.

## Validation

- `npm run typecheck`
- Verify the subscription settings overlay has visible left and right borders.
- Verify the top and bottom borders line up with the new side borders.

## Completion notes

- Updated `ProviderSettingsDialog.render()` to render the inner content at `width - 2` and wrap all interior lines with accent-colored `│` borders.
- Replaced the first and last rendered lines with matching boxed top/bottom borders using `┌ ┐` and `└ ┘` so the settings overlay now reads as a complete frame.
- Used `truncateToWidth()` and `visibleWidth()` while wrapping so ANSI-colored content still aligns correctly against the right border.
