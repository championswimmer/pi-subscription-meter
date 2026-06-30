# GitHub Copilot provider implementation

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Implement the GitHub Copilot provider in `/subscriptions` so it shows live personal Copilot limits for premium interactions and chat limits, using the currently available local GitHub/Copilot auth and the Copilot internal usage endpoints.

## Checklist

- [x] Inspect the current GitHub Copilot scaffold and runtime-state architecture.
- [x] Reconfirm the known Copilot internal auth flow and response schemas from prior research / adjacent code.
- [x] Implement safe local auth resolution for `github-copilot`.
- [x] Implement Copilot fetch + parse logic for premium and chat windows.
- [x] Include reset/time-left details and pace notch support when reset timestamps are available.
- [x] Wire the provider into the existing subscriptions dialog runtime-state pattern.
- [x] Add robust loading, auth-missing, and schema-mismatch handling.
- [x] Run typecheck.
- [x] Run a live fetch validation against local Copilot auth if available.
- [x] Update this plan with completion notes.

## Detailed implementation plan

1. Review the existing GitHub Copilot scaffold and the OpenRouter/Codex runtime implementations so Copilot follows the same runtime-state pattern.
2. Re-read `pi-quotas` Copilot fetch/parse logic and current provider research to confirm the internal auth flow:
   - Pi auth token
   - `/copilot_internal/v2/token` exchange when available
   - fallback direct `/copilot_internal/user`
   - optional `gh auth token` fallback if needed
3. Implement a runtime loader in `src/extensions/core/providers/github-copilot.ts` that resolves auth without logging secrets.
4. Fetch Copilot personal usage, normalize the response into at least:
   - `Premium`
   - `Chat`
   and optionally surface extra notes for overage/unlimited behavior.
5. Compute reset/time-left details and pace notch placement if the response includes a quota reset date.
6. Return a `SubscriptionProviderRuntimeState` with live status, notes, auth hints, and usage windows.
7. Validate with typecheck and a live local fetch.
8. Mark the plan complete and document caveats around the unofficial/internal endpoint.

## Risks / questions

- Copilot personal quota endpoints are unofficial/internal and may change without notice.
- The stored Pi auth credential may require token exchange before the `/copilot_internal/user` endpoint accepts it.
- Some responses may omit reset date or absolute entitlements for certain quota types; those windows should degrade gracefully.
- The endpoint may also expose completions or other quotas; this task will intentionally focus on premium + chat first.

## Validation

- `npm run typecheck`
- run a live Copilot fetch using local auth if available
- confirm the provider returns at least `Premium` and `Chat` windows
- verify failure states are shown cleanly when auth or schema changes break the fetch path

## Outcome summary

Implementation is complete for the GitHub Copilot provider.

What changed:
- replaced the static scaffold in `src/extensions/core/providers/github-copilot.ts` with a live runtime loader
- implemented Copilot auth resolution using:
  - Pi-stored GitHub OAuth refresh token
  - Pi-stored Copilot access token fallback
  - `gh auth token` fallback
- implemented the internal Copilot fetch flow using:
  - `GET /copilot_internal/v2/token` token exchange when useful
  - `GET /copilot_internal/user` for the personal quota payload
- normalized the response into the first two user-facing windows requested here:
  - `Premium / month`
  - `Chat / month`
- included monthly reset timing, time-left detail, and the dynamic time-window pace notch
- kept the endpoint explicitly labeled as internal/unofficial in notes and hints

Live validation result:
- local validation succeeded with Pi-stored GitHub Copilot auth
- returned values at implementation time:
  - `Premium / month`: **about 72% used** (`1,076 / 1,500`)
  - `Chat / month`: **Unlimited** on the current plan
- current status line: `premium 72% used • chat unlimited`

Follow-up:
- completions remain intentionally hidden for now to keep the UI focused on the requested premium + chat counters
- if GitHub changes the internal payload shape, the provider will surface a clean schema-mismatch error rather than silently misreporting values