# Anthropic provider implementation

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Implement the Anthropic provider in `/subscriptions` so it shows live personal Claude usage windows using the currently available local Anthropic auth and the Claude product usage endpoint.

## Checklist

- [x] Inspect the current Anthropic scaffold and the existing runtime-state architecture.
- [x] Reconfirm the known Anthropic personal usage endpoint, auth headers, and response schema from prior research / adjacent code.
- [x] Implement safe local auth resolution for `anthropic`.
- [x] Implement Anthropic fetch + parse logic for the main user-facing windows.
- [x] Include reset/time-left details and pace notch support when reset timestamps are available.
- [x] Surface extra-usage / overage information when present.
- [x] Wire the provider into the existing subscriptions dialog runtime-state pattern.
- [x] Add robust loading, auth-missing, and schema-mismatch handling.
- [x] Run typecheck.
- [x] Run a live fetch validation against local Anthropic auth if available.
- [x] Update this plan with completion notes.

## Detailed implementation plan

1. Review the Anthropic scaffold and the existing OpenRouter, Codex, and Copilot runtime implementations so Anthropic follows the same provider pattern.
2. Re-read `pi-quotas` Anthropic fetch/parse logic and the provider research docs to confirm the unofficial endpoint, required headers, and response fields (`five_hour`, `seven_day`, model-specific weekly windows, `extra_usage`).
3. Implement a runtime loader in `src/extensions/core/providers/anthropic.ts` that resolves Anthropic auth via Pi auth storage.
4. Fetch `GET https://api.anthropic.com/api/oauth/usage` with the required OAuth beta header and timeout handling.
5. Normalize the response into the first user-facing windows to show in the UI:
   - `5h`
   - `7d`
   - optional extra usage / monthly overage window if present
6. Compute reset/time-left details and pace notch placement from the reset timestamps.
7. Return a `SubscriptionProviderRuntimeState` with live status, notes, auth hints, and usage windows.
8. Validate with typecheck and a live local fetch.
9. Mark the plan complete and document caveats around the unofficial endpoint.

## Risks / questions

- Anthropic personal usage comes from an unofficial product endpoint and may change without notice.
- Different plans may expose different weekly model-specific windows or omit `extra_usage` entirely.
- Reset timestamps may not be sufficient to infer exact window start times in every case; when they are not, the pace notch should be omitted.
- The endpoint is percentage-oriented, so there may be no absolute message/token limits to show.

## Validation

- `npm run typecheck`
- run a live Anthropic fetch using local auth if available
- confirm the provider returns at least `5h` and `7d` windows
- verify failure states are shown cleanly when auth or schema changes break the fetch path

## Outcome summary

Implementation is complete for the Anthropic provider.

What changed:
- replaced the static scaffold in `src/extensions/core/providers/anthropic.ts` with a live runtime loader
- implemented Anthropic auth resolution using `AuthStorage.getApiKey("anthropic")`
- fetched the unofficial Claude personal usage endpoint:
  - `GET https://api.anthropic.com/api/oauth/usage`
- normalized the response into personal usage windows including:
  - `5h`
  - `7d`
  - optional model-specific weekly windows
  - optional `Extra (<currency>)` monthly overage budget window
- added reset/time-left detail and the dynamic time-window pace notch
- added a targeted error path for the common case where only `ANTHROPIC_API_KEY` is configured, which is valid for official Anthropic API usage but not for Claude personal usage windows

Validation result:
- `npm run typecheck` passed
- local runtime execution succeeded structurally, but the configured local credential was an API key from `ANTHROPIC_API_KEY`, not a Claude OAuth token
- the provider now correctly surfaces a user-facing error explaining that `/login` Claude auth is required for the personal meter

Follow-up:
- if desired later, we can add a separate official Anthropic admin/org analytics mode using `x-api-key` and the documented `/v1/organizations/usage_report/messages` endpoint
- for now this provider intentionally targets the Claude personal subscription-style windows