# Kilo Code / Kilo Gateway provider integration

- **Status:** in-progress
- **Date:** 2026-06-30
- **Owner:** agent

## Objective

Research whether Kilo Code exposes enough usage, billing, or balance data to support this repository’s subscription-provider UI, and define a safe implementation plan for adding Kilo Code as a provider.

## Research summary

### Confirmed available data

**Officially documented**
- Kilo AI Gateway returns per-request usage data in API responses.
  - Non-streaming responses include a `usage` field.
  - Streaming responses include usage in the final SSE chunk before `[DONE]`.
- Kilo docs explicitly describe tracked fields including:
  - `model`
  - `provider`
  - `input_tokens`
  - `output_tokens`
  - `cache_write_tokens`
  - `cache_hit_tokens`
  - `cost_microdollars`
  - `time_to_first_token`
  - `is_byok`
- Kilo docs describe account and organization balances, daily org member spend limits, and a usage analytics dashboard.
- Kilo docs describe how to obtain a Kilo Gateway API key from the user’s profile for use outside the extension.

**Source-exposed in Kilo’s open-source client**
- `GET ${KILO_API_BASE}/api/profile`
- `GET ${KILO_API_BASE}/api/profile/balance`
- Headers used by the first-party client:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
  - optional `x-kilocode-organizationid: <orgId>` for team balance context
- Observed return shapes:
  - profile: user identity + organizations
  - balance: `{ balance: number }`

### Important limitations

- I did **not** find a publicly documented historical usage REST endpoint equivalent to OpenRouter’s daily/weekly/monthly usage summary APIs.
- Kilo’s detailed analytics are officially documented as a **dashboard** feature, but I did not confirm a supported public JSON API for those analytics.
- The profile/balance endpoints are visible in first-party source, but are not currently documented as public external APIs in the docs reviewed.
- Kilo’s data model is more naturally **credit/balance + per-request usage** than **subscription-window percentages**.

## Implementation decision

**Yes — Kilo Code is a viable provider candidate**, but the initial implementation should be scoped honestly:

1. **Phase 1:** support Kilo balance/account context and clear usage/billing notes.
2. **Phase 2:** optionally add richer usage summaries only if a stable analytics endpoint is confirmed.
3. Do **not** pretend Kilo has documented 5h / weekly / monthly quota windows unless we later verify them.

## Checklist

- [x] Add Kilo Code to provider research references and clearly label official vs source-exposed APIs.
- [x] Define a new provider ID and registry entry for Kilo Code.
- [x] Decide provider naming (`kilocode` vs `kilo-gateway`) and UI copy.
- [x] Research credential discovery order for Kilo auth in this repo (Pi auth storage first, then env/manual fallback).
- [x] Determine whether we can access a Kilo account bearer token, not just the Kilo Gateway API key.
- [x] Implement Kilo profile fetch helper.
- [x] Implement Kilo balance fetch helper with optional organization context.
- [x] Map returned data into `SubscriptionProviderRuntimeState` for a balance-centric provider tab.
- [x] Decide how to represent Kilo in a UI built around usage windows when only balance is known.
- [x] Add defensive labeling for undocumented/source-exposed endpoints.
- [x] Infer total credits as `used + remaining` when Kilo reports usage plus balance but omits an explicit total.
- [ ] Add tests for Kilo response parsing and degraded/error states.
- [x] Re-run `npm run typecheck` after the inferred-total adjustment.

## Detailed implementation plan

1. **Provider shape and naming**
   - Add a new provider definition file at `src/extensions/core/providers/kilocode.ts`.
   - Extend `SubscriptionProviderId` with the `kilocode` identifier.
   - Register the provider in `src/extensions/core/providers/index.ts`.
   - Keep it disabled by default for now because auth discovery relies on external Kilo state rather than Pi-native `/login` support.

2. **Credential strategy**
   - First inspect whether Pi auth storage already contains Kilo credentials.
   - Fall back in this order:
     - Pi auth `kilocode`
     - Pi auth `kilo`
     - local Kilo auth at `~/.local/share/kilo/auth.json`
     - legacy config at `~/.kilocode/cli/config.json`
     - env vars such as `KILO_API_KEY`
   - Support optional org context via stored `accountId` or env vars like `KILO_ORGANIZATION_ID`.
   - This initial implementation treats API-key and OAuth-style Kilo tokens as bearer credentials for the profile/balance endpoints because live validation confirmed `KILO_API_KEY` works against `/api/profile` and `/api/profile/balance`.

3. **Initial data sources**
   - Use `GET /api/profile` to discover account identity and available organizations.
   - Use `GET /api/profile/balance` to fetch personal or org balance.
   - If org context is supported, send `x-kilocode-organizationid` when the user has selected an org/workspace.
   - Treat these endpoints as **source-exposed / not fully documented public API** in comments and user-facing notes.

4. **Runtime-state mapping**
   - Build a balance-first runtime state rather than fake quota percentages.
   - The implementation now shows provider-specific rows for:
     - `Total Credits` (when reported; or inferred as `used + remaining` when Kilo reports usage plus balance)
     - `Credits Left`
     - `Account`
     - `Credit Status`
   - The dialog renderer was adjusted so provider rows can show status/detail information even when they do not have a meaningful percentage bar.
   - Keep the UI honest by labeling inferred totals as derived from used + remaining credits rather than directly reported.
   - If future analytics APIs are confirmed, add date-bucketed usage windows then.

5. **Error handling and fallback behavior**
   - If only a Kilo Gateway API key is available but no bearer token is available for profile/balance endpoints, return a partial state explaining that request-level usage is supported by Kilo but account balance requires account auth.
   - If the balance endpoint fails, keep the provider visible with an honest error note rather than hiding it.
   - Never log raw tokens or organization IDs unnecessarily.

6. **Testing**
   - Add unit tests for:
     - profile response parsing
     - balance response parsing
     - org-header behavior
     - missing-auth and non-200 responses
   - Add at least one test for the “partial/informational only” state when balance auth is unavailable.

7. **Validation**
   - Run `npm run typecheck`.
   - Manually verify with a real Kilo account if credentials are available.
   - Confirm UI wording clearly distinguishes:
     - documented per-request usage behavior
     - dashboard-only analytics
     - source-exposed profile/balance endpoints

## Risks / questions

- The biggest open question is **credential access**: the usable balance/profile endpoints appear to need a Kilo bearer token, which may not be the same as the documented Kilo Gateway API key.
- Kilo’s first-party client source shows balance/profile endpoints, but those endpoints are not clearly documented as public external APIs.
- This repository’s current UI favors quota-window providers; Kilo may fit better as a balance-oriented provider.
- Organization selection may require extra UI/state if we want to support team balances cleanly.

## Validation

- [x] `npm run typecheck`
- [x] Manual verification with real Kilo credentials (`/api/profile` + `/api/profile/balance` validated against the current local Kilo auth / `KILO_API_KEY` setup on 2026-06-30)
- [ ] Confirm graceful degraded behavior when only partial auth is available
- [x] Re-run `npm run typecheck` after the inferred-total adjustment
- [x] Confirm docs/notes clearly label source stability
