# OpenAI Codex provider implementation

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Implement the OpenAI Codex provider in `/subscriptions` so it shows both the current session window and weekly window usage/limits using the ChatGPT/Codex usage API and locally available auth/account identifiers.

## Checklist

- [x] Inspect the current runtime-state architecture and the existing OpenAI Codex scaffold.
- [x] Reconfirm the known Codex usage endpoint, auth headers, and response-shape variants from prior research / adjacent code.
- [x] Implement safe local auth + account-id resolution for `openai-codex`.
- [x] Implement Codex fetch + parse logic for session and weekly windows.
- [x] Wire the Codex provider to the subscriptions dialog using the existing async runtime-state pattern.
- [x] Add robust loading, auth-missing, and schema-mismatch handling.
- [x] Run typecheck.
- [x] Run a live fetch validation against local Codex auth if available.
- [x] Update this plan with completion notes.

## Detailed implementation plan

1. Review the current provider types, dialog runtime-state flow, and the existing OpenRouter implementation so Codex can follow the same pattern.
2. Re-read the OpenAI Codex scaffold and the relevant `pi-quotas` / `pi-usage` research notes to confirm the unofficial `backend-api/wham/usage` endpoint, headers, and the known response-shape variants.
3. Implement account-id resolution with a defensive source order, using Pi-managed auth first and `~/.codex/auth.json` as fallback when needed.
4. Implement a fetcher for `https://chatgpt.com/backend-api/wham/usage` with required headers and timeout handling.
5. Implement a parser that can normalize the known response variants into the extension’s window model, explicitly targeting a session/5-hour-like primary limit and a weekly secondary limit.
6. Return a `SubscriptionProviderRuntimeState` that includes live status, session and weekly windows, and clear explanatory notes that this is an unofficial endpoint.
7. Validate with typecheck and, if local auth is available, run the loader directly to confirm the returned windows are plausible.
8. Mark the plan complete and document caveats / follow-up recommendations.

## Risks / questions

- The endpoint is unofficial and may change shape; at least two response variants are already known.
- Codex requests require an account ID in addition to the bearer token; that ID may not always be present in Pi auth storage.
- The meaning of "session" may map to a 5-hour or primary rate-limit window rather than a literal IDE session.
- If the endpoint returns only percentage information without absolute quota numbers, the UI may need to phrase limits carefully.

## Validation

- `npm run typecheck`
- run a live Codex fetch using local auth if available
- confirm the provider returns two primary windows: session and weekly
- verify failure states are shown cleanly when token/account-id are unavailable or the schema changes

## Outcome summary

Implementation is complete for the OpenAI Codex provider.

What changed:
- replaced the static scaffold in `src/extensions/core/providers/openai-codex.ts` with a live runtime loader
- used `AuthStorage.getApiKey("openai-codex")` for the bearer token
- resolved `ChatGPT-Account-Id` from Pi auth first, with `~/.codex/auth.json` as fallback
- fetched the unofficial `GET https://chatgpt.com/backend-api/wham/usage` endpoint
- normalized the returned response into two primary windows:
  - `Session`
  - `Weekly`
- added defensive parsing for multiple known response-shape variants and clear schema-mismatch errors

Live validation result:
- local validation succeeded with Pi-stored OpenAI/Codex auth
- returned values at implementation time:
  - `Session`: **4% used**
  - `Weekly`: **1% used**
- current response shape exposes percentage-based usage windows rather than absolute token/message limits

Follow-up:
- if we later want richer Codex presentation, we can optionally surface credits/spend-control state as secondary notes or extra windows
- because this endpoint is unofficial, keep the implementation isolated and defensive