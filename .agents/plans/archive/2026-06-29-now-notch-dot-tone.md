# Now-notch dot styling and tone

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Refine the dynamic `now` notch so it uses a minimal dot-style glyph and a meaningful status color: red when usage is ahead of the current time pace, green when usage is behind pace, and a neutral accent when roughly on pace.

## Checklist

- [x] Review the current progress-bar marker glyph and color flow.
- [x] Switch the `now` marker to a minimal dot-style glyph.
- [x] Derive the `now` marker color from usage-vs-time pacing.
- [x] Preserve sane neutral behavior when pacing data is unavailable or effectively on target.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect `progress-bar.ts` and `subscriptions-dialog.ts` to confirm how the marker glyphs and colors are currently supplied.
2. Replace the current diamond-style `now` marker defaults with simple dot-style glyphs that remain single-column and readable across terminals.
3. Add a small helper in the subscriptions dialog that compares actual usage percent to pacing percent and returns:
   - `error` when usage is ahead of pace / less left than expected
   - `success` when usage is behind pace / more left than expected
   - `accent` when near parity or when comparison data is missing
4. Pass that dynamic marker color into `renderProgressBar()` while leaving threshold notch styling unchanged.
5. Run `npm run typecheck` and document the final glyph and color behavior.

## Risks / questions

- Some dot glyphs can look faint on certain terminals, so the chosen pair should still be visible over both filled and empty bar segments.
- Exact equality between usage and pace may be rare due to rounding, so a tiny tolerance avoids noisy red/green flips.
- The color logic should be based on underlying usage-vs-time pacing semantics, not merely the currently selected display mode.

## Validation

- `npm run typecheck`
- Verify the `now` marker uses dot-style glyphs instead of diamonds.
- Verify the `now` marker is red when usage is ahead of pace.
- Verify the `now` marker is green when usage is behind pace.
- Verify the `now` marker stays neutral when pacing is unavailable or effectively equal.

## Completion notes

- Swapped the `now` marker glyphs from diamond-style markers to a minimal dot pair: `•` for filled territory and `◦` for empty territory.
- Added pacing-aware `now` marker coloring in the subscriptions dialog based on raw usage-vs-time comparison.
- The `now` marker is now `error` when usage is ahead of pace, `success` when usage is behind pace, and `accent` when pace data is missing or within a small ±1% tolerance band.
- Threshold-notch styling remains unchanged and independent from the `now` marker.
