# OpenRouter provider implementation

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Implement the OpenRouter provider first so `/subscriptions` shows live OpenRouter budget and usage data using the official `GET /api/v1/key` endpoint and existing local auth sources.

## Checklist

- [x] Inspect the current provider/UI scaffolding to find the right integration seam for live provider data.
- [x] Confirm how Pi-managed auth is stored locally and add a safe OpenRouter API key lookup path.
- [x] Implement OpenRouter fetch + parse logic based on the official `/api/v1/key` response.
- [x] Wire the OpenRouter provider tab to fetch live data and render real values/statuses.
- [x] Keep non-OpenRouter providers working as placeholders.
- [x] Add clear loading/error/auth-missing states for the OpenRouter tab.
- [x] Run typecheck.
- [x] Verify the live OpenRouter fetch returns the expected current credit/budget data.
- [x] Update this plan to completed with outcome notes.

## Detailed implementation plan

1. Review the current provider definition types, registry, and subscriptions dialog rendering flow to determine how live provider state should be introduced without breaking the scaffold tabs.
2. Inspect adjacent `pi-quotas` OpenRouter implementation and Pi local auth conventions so the implementation can reuse the same auth source order where possible.
3. Add a small internal quota model for the extension, likely with fetch status + normalized windows, so live providers can augment the existing provider metadata.
4. Implement an OpenRouter API key resolver that prefers environment configuration and/or Pi-managed auth state, while avoiding logging secrets.
5. Implement the OpenRouter fetcher against `https://openrouter.ai/api/v1/key`, normalize the response into the extension’s window shape, and capture enough metadata to show the user’s current available credits/budget.
6. Update the subscriptions dialog so the OpenRouter tab fetches on open, shows loading/error states, and renders the normalized windows instead of static placeholders when data is available.
7. Run typecheck and perform a live fetch validation against the user’s configured OpenRouter auth.
8. Update this plan with completion notes and any follow-up recommendations for implementing the remaining providers.

## Risks / questions

- The repo currently only has static provider definitions, so adding live state should avoid over-coupling the dialog to a single provider.
- Pi auth storage may contain different credential shapes depending on how the user authenticated; the resolver should be defensive.
- OpenRouter keys can be normal API keys or management keys; `/api/v1/key` should work for the standard key metadata path, but the UI should not assume every optional field is present.
- The user’s shown value (`$62.66`) may represent either `limit_remaining` or a related balance field depending on key configuration, so UI wording should reflect the actual field being displayed.

## Validation

- `npm run typecheck`
- run a live OpenRouter fetch using local auth and confirm the returned visible balance matches the user’s current OpenRouter value
- verify the OpenRouter tab renders real values while other providers remain scaffold placeholders
- verify missing auth and HTTP errors are shown cleanly rather than crashing the dialog

## Outcome summary

Implementation is complete for the first live provider.

What changed:
- added a live OpenRouter runtime loader to `src/extensions/core/providers/openrouter.ts`
- used Pi `AuthStorage.create().getApiKey("openrouter")` so the provider can read either `/login`-stored auth or `OPENROUTER_API_KEY`
- fetched both official OpenRouter endpoints:
  - `GET /api/v1/key` for key-scoped usage windows
  - `GET /api/v1/credits` for account credit totals / remaining credits
- updated the subscriptions dialog to support:
  - async provider loading
  - loading and error states
  - refresh with `r`
  - live provider notes / hints
  - display-mode preservation (`used` vs `remaining`)

Live validation result:
- local validation against the configured OpenRouter key returned approximately **$62.63 credits remaining** at implementation time
- this is within the user-expected current credit range and is likely slightly time-sensitive as usage updates

Follow-up:
- implement the next official providers using the same runtime-state pattern
- keep OpenRouter as the reference implementation for the other provider tabs