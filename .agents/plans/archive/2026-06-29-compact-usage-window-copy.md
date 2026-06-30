# Compact usage-window copy

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Reduce verbose usage-window helper text in `/subscriptions` so rows stay compact in the TUI. Keep the primary `% used` / `% left` signal in the bar status, and shorten any remaining secondary detail text to concise numeric summaries.

## Checklist

- [x] Review current usage-window detail strings in implemented providers.
- [x] Shorten Codex window detail copy so it no longer repeats `% used` or the full time-window description.
- [x] Shorten GitHub Copilot window detail copy to compact count-based summaries.
- [x] Shorten OpenRouter window detail copy and remove redundant explanatory prose where the row title already provides context.
- [x] Run `npm run typecheck`.
- [x] Mark this plan complete with implementation notes.

## Detailed implementation plan

1. Inspect the current detail-label builders in `openai-codex.ts`, `github-copilot.ts`, and `openrouter.ts` to identify which phrases repeat the row title or the right-hand status text.
2. Update Codex window detail generation so the row keeps only compact secondary context such as elapsed-window pacing, instead of repeating strings like `4% used of the current 5-hour session limit`.
3. Update GitHub Copilot window detail generation to use terse numeric forms such as `40/300 • 260 left • 32% elapsed`, while keeping special cases like unlimited or missing quota concise.
4. Update OpenRouter window detail generation to use compact budget/credit summaries and remove descriptive prose from daily/weekly/monthly rows where the title and reset line already explain the time window.
5. Run `npm run typecheck` and then update this plan with completion notes reflecting the final copy decisions.

## Risks / questions

- Some detail lines provide the only absolute-quantity context for percentage-based rows, so shortening them should preserve useful count/currency information where available.
- OpenAI Codex only exposes percentages, so its compact secondary text may need to focus on elapsed-window pacing rather than absolute counts.
- Over-shortening special cases like unlimited or missing snapshots could make the state ambiguous; keep those labels concise but still understandable.

## Validation

- `npm run typecheck`
- Verify Codex rows no longer show `X% used of the current ...` detail text.
- Verify Copilot and OpenRouter detail lines fit more comfortably in narrow overlay widths.
- Verify rows without meaningful secondary context can omit `detailLabel` entirely.

## Completion notes

- Codex detail text now keeps only compact pacing context like `33% elapsed`, leaving `% used` / `% left` to the right-hand status.
- GitHub Copilot detail text now uses terse count-based summaries like `40/300 • 260 left • 32% elapsed`, with compact special-case copy such as `overage ok`.
- OpenRouter budget and credit rows now use short numeric summaries, and the daily/weekly/monthly tracking rows rely on the title plus reset line instead of extra prose.
