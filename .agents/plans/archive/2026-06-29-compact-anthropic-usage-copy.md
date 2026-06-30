# Compact Anthropic usage copy

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Shorten Anthropic usage-window helper text so it matches the compact style already used for the other providers. The row title and right-hand `% used` / `% left` status should carry the primary meaning; secondary detail text should stay terse.

## Checklist

- [x] Review the current Anthropic usage-window detail-label builders.
- [x] Remove verbose repeated phrases like `X% used of the current ... limit`.
- [x] Keep Anthropic time-window detail text compact and consistent with other providers.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect `src/extensions/core/providers/anthropic.ts` for the detail-label builders that still emit long explanatory phrases.
2. Update the percentage-based Claude window rows so they only show compact pacing context such as `33% elapsed`, relying on the row title and right-side status text for the rest.
3. Tighten the extra-usage row into a short numeric summary, dropping redundant reset and long-form time-window wording because reset time is already rendered separately.
4. Run `npm run typecheck` and document the final compact copy choices in this plan.

## Risks / questions

- Anthropic only exposes percentages for the 5h/7d windows, so there is limited useful secondary information beyond pacing.
- The extra-usage row still benefits from keeping actual currency amounts visible, but the copy should remain brief.

## Validation

- `npm run typecheck`
- Verify Anthropic rows no longer show `X% used of the current ... limit`.
- Verify Anthropic detail text is limited to terse pacing or compact numeric summaries.

## Completion notes

- Anthropic 5h/7d detail labels now match the compact style used by the other providers and only show terse pacing context such as `33% elapsed`.
- Removed redundant reset and long-form limit wording from Anthropic usage-window detail labels because the row title and shared reset line already provide that context.
- Anthropic extra-usage rows now use a short currency summary like `$3.20/$10.00 • 48% elapsed`.
