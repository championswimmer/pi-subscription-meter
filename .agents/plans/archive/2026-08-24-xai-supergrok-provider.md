# xAI SuperGrok provider integration

## Status
Implementation in progress

## Objective
Add an xAI provider to `/subscriptions` that reuses the OAuth credential stored by Pi’s `/login xai` **Use a subscription** flow and displays the authenticated user’s SuperGrok quota/usage. The data source must be explicitly identified as official or unofficial, and no credential may be logged or copied outside Pi’s existing auth storage.

## Checklist
- [x] Inspect the repository provider/auth architecture and Pi’s documented xAI `/login` behavior.
- [x] Identify and validate the xAI SuperGrok usage endpoint, token type, required headers, and response mapping.
- [x] Record xAI endpoint/auth/stability findings in the provider research reference.
- [x] Add xAI auth discovery for `XAI_API_KEY`, while rejecting it for this personal-subscription meter.
- [x] Implement the xAI provider loader with defensive parsing and clear unofficial-endpoint messaging where applicable.
- [x] Register the provider and update user-facing documentation.
- [x] Run typecheck and targeted non-secret validation.
- [x] Update this plan with the actual implementation and validation results.
- [x] Commit the completed work and push the current branch (`3162a21`, pushed to `origin/main`).

## Detailed implementation plan
1. Inspect Pi’s installed provider/auth implementation and documentation to establish the `xai` auth-store key, subscription credential shape, refresh handling, and supported API-key fallback. Reuse `createSubscriptionAuthStorage().getApiKey("xai")` so Pi remains the owner of OAuth refresh and storage.
2. Research the SuperGrok end-user quota source. Prefer a documented API; if the only viable source is a Grok product/private endpoint, record its URL, bearer/header requirements, schema, quota-window/reset semantics, and fragility in `.agents/skills/api-subscription-research/references/PROVIDERS.md` before wiring it into the UI.
3. Add the missing `xai: ["XAI_API_KEY"]` auth-discovery mapping. The personal subscription meter must reject API-key credentials rather than treating API credit access as SuperGrok quota. Do not read or print raw auth-file contents; rely on Pi `AuthStorage` where available. A sanitized local check confirms that a Pi xAI OAuth entry is present with `access`, `refresh`, and `expires` fields.
4. Add `src/extensions/core/providers/xai.ts`, following the existing personal-subscription provider pattern. Reuse the Pi `/login xai` OAuth bearer with the undocumented `GET https://cli-chat-proxy.grok.com/v1/user` followed by `GET /v1/billing?format=credits` and its validated `x-userid` header. Use the Grok CLI proxy headers, timeout/error isolation, bounded JSON reads, and defensive parsing. The validated endpoint currently returned `currentPeriod` as `USAGE_PERIOD_TYPE_WEEKLY`; it may omit a percentage, which must render as “not reported” rather than an invented `0%`.
5. Add the `xai` provider ID and registry entry. Enable it by default only if it behaves consistently with existing live quota providers; otherwise keep it discoverable in Settings but disabled by default. Ensure saved settings normalize correctly through the registry.
6. Update README provider lists and the provider research reference with the exact behavior and limitations. Avoid claims that an xAI API key represents a SuperGrok subscription if it does not.
7. Run `npm run typecheck`; make safe targeted validation requests only if local Pi xAI subscription auth is configured, and output solely status/schema-level data. Inspect the diff and update this plan with results.
8. Commit only the xAI plan, source, and documentation changes with a focused message; push `main` to `origin` and report the commit hash/push status.

## Risks / questions
- SuperGrok subscription quota data is served by an undocumented Grok CLI proxy endpoint, which can change or be account/rollout-specific.
- Pi’s xAI OAuth token was validated against the proxy on 2026-08-24; the direct grok.com gRPC billing RPC returned an empty body and is deliberately not used.
- `XAI_API_KEY` supports xAI API usage but does not represent a personal SuperGrok subscription, so it is detected only to provide a precise login hint.
- The implementation must not log bearer tokens, cookies, account identifiers, or full response bodies.

## Implementation and validation results
- Added `xai` to the auth discovery map but only accepts a stored Pi OAuth credential for this provider; API-key credentials receive an explicit subscription-login hint.
- Added `src/extensions/core/providers/xai.ts`, registered it by default, and added `xai` to `SubscriptionProviderId`. It makes bounded, redirect-blocked calls to the undocumented Grok CLI proxy and never logs or persists its temporary user id or billing body.
- The provider renders `creditUsagePercent` when supplied. If xAI supplies only an active period, it renders “Usage not reported” rather than claiming `0%` usage.
- Updated `README.md` and the provider research reference with the login requirement, endpoints, headers, response fields, source links, and unofficial-endpoint limitation.
- 2026-08-24 safe live verification: Pi `xai` auth was present, `pi auth check --provider xai` returned `ready`, and both proxy endpoint calls returned HTTP 200 with a valid weekly period. No secrets, account identifiers, or raw response bodies were printed.
- Passed `npm run typecheck` and `git diff --check`.

## Remaining validation
None.
