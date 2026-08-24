# Codex usage API follow-up

## Status
Completed

## Objective
Research the current ChatGPT/Codex `backend-api/wham/usage` behavior to confirm how its usage data should be interpreted and whether both session and weekly limits are still active. Then update the Codex provider display so it matches the current product behavior without overstating stale limits.

## Checklist
- [x] Re-read the current Codex provider implementation and prior provider research notes.
- [x] Gather fresh evidence on current Codex usage-limit behavior from official OpenAI sources and current reverse-engineered observations.
- [x] Validate the currently observed `wham/usage` response shape locally if usable auth is available.
- [x] Decide whether the UI should keep showing both Session and Weekly windows or de-emphasize/remove the session limit.
- [x] Update the Codex provider code and copy accordingly.
- [x] Update provider research references with any newly confirmed facts.
- [x] Run validation checks for the changed provider logic.

## Detailed implementation plan
1. Inspect `src/extensions/core/providers/openai-codex.ts` and the existing provider-research notes to document the current assumptions: the endpoint is unofficial, the parser expects primary/session and secondary/weekly windows, and the UI currently describes both as active limits.
2. Collect fresh evidence on current Codex behavior, prioritizing official OpenAI help/pricing/product docs. Supplement with reverse-engineered or third-party observations only where OpenAI does not document the exact internal response semantics.
3. If local Codex auth is available, make a sanitized live request to `https://chatgpt.com/backend-api/wham/usage` and inspect only non-sensitive fields so we can verify whether session/5-hour data is still returned and whether it appears enforced or merely informational.
4. Based on the evidence, define the target UX for Codex:
   - if weekly is the only currently enforced limit, present weekly as the primary limit and label any session/5-hour data as informational or temporarily inactive;
   - if both are still active, keep both windows but tighten the wording about how usage is calculated.
5. Update `src/extensions/core/providers/openai-codex.ts` so parsing, status text, descriptions, notes, and placeholder rows reflect the current understanding. Keep the implementation clearly labeled as unofficial and defensive against schema drift.
6. Update `.agents/skills/api-subscription-research/references/PROVIDERS.md` with any newly confirmed Codex facts so future work starts from the latest known behavior.
7. Run the relevant checks (at minimum `npm run typecheck`, plus any focused live/manual validation that is safe with local auth) and record the results here.

## Risks / questions
- The `wham/usage` endpoint is unofficial and may change without notice.
- Official OpenAI docs may describe product-level usage limits without documenting the internal API schema.
- A live local response may differ by plan tier or account state, so UI wording should avoid over-generalizing from a single account.
- If the 5-hour/session limit is temporarily removed rather than permanently deleted, we may need a display that can adapt when it reappears.

## Findings
- Official Codex pricing/help docs still describe usage as a product meter whose burn varies with model, context, reasoning, tool use, caching, and local-vs-cloud execution; the public docs are more explicit about five-hour windows than about the internal `wham/usage` schema.
- A sanitized live request on 2026-07-26 for a Plus account returned `rate_limit.primary_window.limit_window_seconds = 604800` (7 days), `used_percent = 4`, and `secondary_window = null`.
- That means the current endpoint can expose a weekly window as `primary_window`, so treating `primary_window` as “Session” is incorrect.
- For the validated account snapshot, the weekly limit was active and a separate session/5-hour window was not returned.

## Validation
- `npm run typecheck` ✅
- Live `GET https://chatgpt.com/backend-api/wham/usage` validation run with sanitized output only; no secrets logged ✅
- Codex provider copy and parsing updated to show whichever active windows the endpoint currently returns, including weekly-only responses ✅
