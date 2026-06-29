# Stable subscriptions dialog height

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Keep the `/subscriptions` overlay at a stable height across provider tabs so the layout does not jump as different tabs render different numbers of progress-bar rows.

## Checklist

- [x] Review the current subscriptions dialog render flow and identify where variable-height content is emitted.
- [x] Add a stable minimum dialog height tuned for the common maximum of four usage windows.
- [x] Pad shorter provider views so the footer stays anchored in the same place across tabs.
- [x] Preserve the ability for unusually tall content to grow beyond the stable minimum when needed.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect `src/extensions/core/ui/subscriptions-dialog.ts` to locate the point where provider-specific content ends and the common footer begins.
2. Define a stable target height based on the typical upper bound of four progress bars, leaving room for compact labels, reset lines, and footer controls.
3. Insert blank content rows before the footer until the dialog reaches that minimum total height, while leaving taller real content untouched.
4. Run `npm run typecheck` and record the final target-height behavior in this plan.

## Risks / questions

- Picking too small a stable height will still cause jumps for some providers; picking too large a height wastes screen space on smaller terminals.
- The padding should happen inside the bordered content area so the overlay feels intentionally fixed rather than externally stretched.

## Validation

- `npm run typecheck`
- Verify switching between common provider tabs no longer moves the footer noticeably.
- Verify providers with unusually tall content can still exceed the stable minimum instead of clipping.

## Completion notes

- Added a stable minimum total dialog height of 32 rendered lines in `SubscriptionsDialog`.
- Shorter provider tabs are now padded with blank content rows before the common footer, so the footer stays anchored across normal tab switches.
- Taller content is still allowed to exceed the minimum naturally, so nothing is clipped for providers that eventually need more than the common four-window layout.
