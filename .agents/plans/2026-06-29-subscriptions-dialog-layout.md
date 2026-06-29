# Subscriptions dialog layout refinement

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Refine the `/subscriptions` dialog so it is centered on screen and uses adaptive progress-bar widths (10, 20, or 30 characters) based on available width instead of hardcoding a 20-character maximum.

## Checklist

- [x] Inspect the current subscriptions dialog render path and any surrounding layout constraints.
- [x] Implement horizontal centering for the rendered dialog.
- [x] Replace the fixed progress-bar width logic with adaptive 10/20/30 sizing based on available content width.
- [x] Run typecheck.
- [x] Update this plan with completion notes.

## Detailed implementation plan

1. Review `src/extensions/core/index.ts` and `src/extensions/core/ui/subscriptions-dialog.ts` to confirm where screen width is available and where centering should be applied.
2. Update the dialog renderer so each line is padded on the left to center the bordered box within the current available terminal width.
3. Replace the progress bar width heuristic with a simple tiered rule based on available content width, choosing 10, 20, or 30 characters.
4. Run typecheck to make sure the UI changes do not break the extension.
5. Mark the plan complete with a short outcome summary.

## Risks / questions

- Centering should preserve ANSI color sequences correctly; indentation must be applied outside the styled content.
- The dialog currently constrains its own width, so centering should use the actual rendered box width rather than the full terminal width.
- Progress bars must still fit inside very narrow terminals without causing overflow.

## Validation

- `npm run typecheck`
- verify the rendered dialog lines are left-padded to the center
- verify progress bars switch among 10, 20, and 30 characters depending on width

## Outcome summary

The subscriptions dialog layout is now centered and the progress bars use adaptive widths.

What changed:
- changed the subscriptions overlay anchor from `top-right` to `center`
- widened the overlay to `75%` while keeping the existing minimum width and height constraints
- updated the dialog renderer to horizontally center the bordered box within the available overlay width
- replaced the fixed progress bar width cap with a tiered rule:
  - `10` chars on narrow layouts
  - `20` chars on medium layouts
  - `30` chars on wider layouts

Result:
- the dialog now opens in the center of the screen
- the content box is visually centered inside the overlay
- progress bars scale more naturally with the available width