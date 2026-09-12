# Kimi Code provider — implementation plan

Date: 2026-09-12
Status: in progress

## Goal

Add Kimi Code (Moonshot "Kimi For Coding" / Kimi Coding Plan) as a subscription
provider in this extension, reusing the existing Pi `/login kimi-coding` OAuth
credential so the user can see Kimi quota in the meter.

## Background / research findings

How CodexBar renders Kimi usage limits (sources: CodexBar v0.20 `docs/kimi.md`,
`Sources/CodexBarCore/Providers/Kimi/`, Win-CodexBar `rust/src/providers/kimi/`,
`pi-provider-kimi-code/src/usage.ts`, live probe 2026-09-12):

- CodexBar's native path authenticates with the `kimi-auth` browser cookie
  (imported from Chrome/Safari, manual cookie, or `KIMI_AUTH_TOKEN`) and calls
  `POST https://www.kimi.com/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages`
  plus `MembershipService/GetSubscriptionStats`. It renders the weekly request
  quota (tier-based weekly limits) and the 5h/200-request rate-limit window with
  reset times.
- The better path for this extension is the Kimi Code API used by
  `pi-provider-kimi-code` and `pi-kimi-code-console-usage`:
  `GET https://api.kimi.com/coding/v1/usages` with `Authorization: Bearer <token>`,
  where the token is the Pi `kimi-coding` OAuth access token (same one stored by
  `/login` in `~/.pi/agent/auth.json` under key `kimi-coding`). Response:
  `{ usage: { limit, used, remaining, resetTime }, limits: [{ window: { duration,
  timeUnit }, detail: { limit, used, remaining, resetTime } }], parallel: { limit },
  boosterWallet?: {...} }` plus `user.membership.level`. Values are numeric
  strings. `GET .../v1/me` returns `{ user_id, nickname, user_level, ... }`.
- Live probe with the user's stored credential returned HTTP 200 with exactly
  this shape (weekly usage + one 5h window + parallel limit + LEVEL_BASIC).
- Endpoint is undocumented but read-only and first-party; Pi owns token refresh,
  so the provider only reads the current access token (never stores/logs it).

## Checklist

- [x] Confirm Kimi usages endpoint schema (provider src + live probe)
- [x] Add `kimi-coding` env keys to `PROVIDER_ENV_KEYS` in `auth.ts`
- [x] Implement `src/extensions/core/providers/kimi-code.ts`
- [x] Register provider in `types.ts` + `index.ts`
- [x] Update `PROVIDERS.md` reference + README provider list
- [x] Typecheck (`npm run typecheck` / `tsc --noEmit`) and verify meter renders

## Step-by-step implementation plan

1. `src/extensions/core/auth.ts`: add
   `kimi-coding: ["KIMI_API_KEY", "KIMI_CODE_API_KEY", "MOONSHOT_API_KEY"]` to
   `PROVIDER_ENV_KEYS` so `getApiKey("kimi-coding")` env fallback works for API-key users.
2. New `src/extensions/core/providers/kimi-code.ts` (modelled on `xai.ts`):
   - `KIMI_CODING_BASE_URL` default `https://api.kimi.com/coding`, overridable via
     `KIMI_CODE_BASE_URL` / `KIMI_BASE_URL` (mirrors pi-provider-kimi-code).
   - Bounded fetch helper (64 KiB cap, `AbortSignal.timeout(20s)`), fail closed on
     non-JSON / schema mismatch.
   - `parseKimiNumber`: accepts numeric strings (live API returns `"100"`) and numbers.
   - Auth: require Pi-managed OAuth credential (`type: "oauth"` under `kimi-coding`);
     API-key-only setups get an explanatory error (a platform API key is billed usage,
     not Coding Plan quota) — same policy as the xAI provider.
   - Windows: weekly quota (`usage` → "Weekly", used% = used/limit, resetAt) and the
     first time-windowed entry in `limits[]` (300 min → "5-hour", used/limit, resetAt).
     Membership level (`user.membership.level`) and parallel-session limit go in notes.
   - `loadKimiCodeRuntimeState()` returns ready/error states in the standard shape.
3. `types.ts`: add `"kimi-code"` to `SubscriptionProviderId`.
   `index.ts`: import + append `kimiCodeProvider` to `DEFAULT_PROVIDERS`
   (enabled by default, like xai).
4. Docs: add a Kimi row to `.agents/skills/api-subscription-research/references/PROVIDERS.md`
   and the README provider list; label the endpoint unofficial/undocumented.
5. Verify: typecheck, then run the extension meter and confirm Kimi windows render;
   press `r` retry path covered by standard error state.

## Risks / notes

- Undocumented endpoint: fail closed with "schema mismatch" if Moonshot changes the shape.
- Token handling: token is only held in memory for the request duration; never logged.
- Do not confuse with Kilo Code (`kilocode.ts`) — different product, different API.
