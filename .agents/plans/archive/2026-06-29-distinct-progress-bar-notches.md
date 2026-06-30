# Distinct progress-bar notch glyphs

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Make threshold notches and the dynamic `now` notch visually distinct in subscription progress bars, without adding legends or changing the existing settings surface.

## Checklist

- [x] Review the current progress-bar rendering API and how subscriptions pass notch data.
- [x] Extend the progress-bar renderer so threshold notches and marker notches can use different glyphs/colors.
- [x] Update subscriptions rendering to pass threshold notches separately from the dynamic `now` notch.
- [x] Keep overlap behavior deterministic when a `now` notch lands on a threshold notch.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect `src/extensions/core/ui/progress-bar.ts` and confirm the current renderer only supports one undifferentiated `notches` array.
2. Extend the `ProgressBarOptions` contract with a second notch layer for marker-style notches, plus separate glyph/color options for that layer.
3. Update the renderer so threshold notches and marker notches are drawn differently, with marker glyphs winning when both land on the same cell.
4. Update `src/extensions/core/ui/subscriptions-dialog.ts` so it passes 50/75 threshold notches through the threshold layer and the moving `now` notch through the marker layer.
5. Run `npm run typecheck`, then record the final glyph choices and overlap behavior in this plan.

## Risks / questions

- Some Unicode glyphs can render inconsistently across terminals, so the chosen characters should stay simple and single-column.
- Overlap behavior must be intentional; otherwise a `now` notch sitting on 50% or 75% could flicker between glyph styles.
- The change should avoid affecting other future progress-bar consumers that may still only use the original notch layer.

## Validation

- `npm run typecheck`
- Verify threshold marks and the `now` mark render with different glyphs.
- Verify a `now` notch on top of a threshold notch still renders a single stable marker glyph.
- Verify bars without a `now` notch still render threshold marks normally.

## Completion notes

- Extended `renderProgressBar()` with a second notch layer, `markerNotches`, so threshold marks and the dynamic `now` mark can be rendered independently.
- Threshold marks now use a muted `┆` glyph, while the `now` mark uses accent-colored `◆` / `◇` glyphs.
- Overlap is deterministic: marker glyphs win over threshold glyphs when both land on the same cell.
- Updated the subscriptions dialog to pass threshold marks via `notches` and the moving `now` position via `markerNotches`.
