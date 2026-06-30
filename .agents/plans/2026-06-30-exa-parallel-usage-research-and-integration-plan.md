# Exa + Parallel usage research and integration plan

- **Status:** planned
- **Date:** 2026-06-30
- **Owner:** agent

## Objective

Document whether Exa and Parallel expose usable API sources for usage, billing, or remaining-credit information when API keys are already available in env, and define a safe implementation plan for adding support in this repository.

## Checklist

- [x] Research official Exa usage/billing docs.
- [x] Research official Parallel usage/billing docs.
- [x] Determine whether remaining credits can be fetched programmatically from each provider.
- [x] Update provider research references with new findings.
- [ ] Add an `exa` provider definition and runtime loader.
- [ ] Decide whether `parallel` should ship as an informational/scaffold provider or remain unsupported until an official usage API exists.
- [ ] Extend provider registry/types/settings/UI wiring for any new provider IDs.
- [ ] Add implementation notes/tests/docs for any shipped provider.

## Detailed implementation plan

1. **Exa: implement official usage support first**
   - Add a new `exa` provider module under `src/extensions/core/providers/`.
   - Add `exa` to `SubscriptionProviderId` and register it in `src/extensions/core/providers/index.ts`.
   - Read auth from Pi auth storage if/when supported, otherwise fall back to `EXA_API_KEY` from env.
   - Use Exa’s documented team-management/admin endpoints:
     - list team API keys
     - fetch per-key usage via `GET https://admin-api.exa.ai/team-management/api-keys/{id}/usage`
   - Because the documented usage endpoint is keyed by API-key ID rather than “current secret key”, prefer one of these strategies:
     1. list all team keys and aggregate usage across them, or
     2. support an optional companion selector such as `EXA_API_KEY_ID` / saved provider setting when the user wants one specific key.
   - Query usage for practical windows such as 1 day, 7 days, and 30 days, then map those results into `SubscriptionUsageWindowDefinition[]`.
   - Be explicit in UI copy that this is **official usage/cost analytics**, not a direct “credits left” endpoint.

2. **Exa: handle the credits-left gap honestly**
   - Do not invent a remaining-balance meter unless Exa publishes a balance endpoint.
   - Show what is actually available today:
     - daily / weekly / monthly spend
     - total cost in the selected period
     - optional per-price-type breakdown in notes/details
   - If users want balance/credits-left later, plan a follow-up investigation into dashboard/private endpoints and label that work unofficial before implementing it.

3. **Parallel: do not implement a fake live meter**
   - Current official docs only point users to **Platform > Usage** for real-time request counts and spend.
   - No documented API for usage, billing, spend history, or remaining credits was found.
   - Therefore, the safe implementation choice is one of:
     - **preferred:** do not add a live `parallel` provider yet, or
     - add a disabled-by-default informational/scaffold provider that explains usage is dashboard-only today.

4. **Parallel: only pursue live data behind a separate unofficial plan**
   - If product requirements later demand Parallel live usage, create a separate plan to inspect private dashboard traffic/browser flows.
   - Any such path must be labeled **private/unofficial/reverse-engineered** in code comments, docs, and UI notes.
   - Keep that work isolated so a break in Parallel’s dashboard internals cannot destabilize the rest of `/subscriptions`.

5. **Cross-cutting implementation tasks**
   - Reuse the runtime-loading pattern used by `openrouter.ts` for official API-backed providers.
   - Add defensive timeout/error handling and clear auth error messages.
   - Keep secrets in memory only; never log raw `EXA_API_KEY` or `PARALLEL_API_KEY` values.
   - Update provider docs/notes so users can distinguish:
     - official API-backed usage analytics
     - dashboard-only integrations
     - unofficial/private endpoints

## Risks / questions

- Exa exposes official per-key usage analytics, but a public balance/remaining-credits endpoint was not found.
- Exa usage is tied to API-key IDs; if a team has multiple keys, UX needs either aggregation or explicit key selection.
- Parallel currently appears to be dashboard-only for usage/spend visibility.
- Private dashboard endpoints may exist for Parallel, but this repo should not assume them without explicit acceptance of unofficial integrations.
- Exa’s documented lookback window should be rechecked against the live docs during implementation because search excerpts showed conflicting historical limits.

## Validation

- Reconfirm the live Exa docs for endpoint path, auth requirements, and lookback limits before coding.
- If Exa is implemented, run `npm run typecheck` and manually verify with a real `EXA_API_KEY`.
- Verify that any shipped Parallel support is clearly marked non-live/informational unless an official API is documented.
