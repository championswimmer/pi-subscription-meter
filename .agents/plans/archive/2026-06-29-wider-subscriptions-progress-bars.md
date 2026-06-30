# Wider subscription progress bars

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Scale subscription progress bars more aggressively on wider terminals so they use 20 / 40 / 60 characters depending on available width.

## Checklist

- [x] Review the current subscriptions dialog width and progress-bar sizing logic.
- [x] Update the dialog width cap so wider terminals can benefit from longer bars.
- [x] Change progress-bar sizing to use 20 / 40 / 60 character steps based on available width.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect the current width calculations in `src/extensions/core/ui/subscriptions-dialog.ts`, especially the dialog width cap and `barWidth` thresholds.
2. Increase the dialog’s internal max render width enough that a 60-character bar has room on wide terminals without making the overlay unreasonably wide.
3. Replace the current 10 / 20 / 30 bar-width thresholds with 20 / 40 / 60 steps derived from the rendered content width.
4. Run `npm run typecheck` and record the final thresholds in this plan.

## Risks / questions

- Making the dialog too wide can hurt readability, so the max width should expand moderately rather than going full-screen.
- Wider bars should still leave enough room for labels and wrapped metadata above and below them.

## Validation

- `npm run typecheck`
- Verify narrow overlays use 20-character bars.
- Verify medium overlays use 40-character bars.
- Verify wide overlays use 60-character bars.

## Completion notes

- Increased the subscriptions dialog internal render-width cap from 72 to 96 columns so wider terminals can actually display longer bars.
- Updated progress-bar sizing thresholds to 20 / 40 / 60 characters based on rendered content width.
- Final thresholds: 20 chars below 56 content columns, 40 chars from 56+, and 60 chars from 80+.
