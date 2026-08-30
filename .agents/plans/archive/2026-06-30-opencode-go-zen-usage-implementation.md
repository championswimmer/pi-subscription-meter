# OpenCode Go + Zen usage implementation

**Date:** 2026-08-24
**Status:** complete

## Goal

Replace the OpenCode scaffold with a live provider tab that shows both products:

- **OpenCode Go** — subscription windows. Official API returns used percent; the UI should emphasize **weekly usage left**, plus the 5h and monthly windows the same endpoint already returns.
- **OpenCode Zen** — pay-as-you-go. Show **dollars left** and **dollars used**. There is still no official Zen balance API, so remaining/used dollars come from the unofficial workspace billing page.

## Checklist

- [x] Research official vs unofficial OpenCode usage sources (Exa + live probe)
- [x] Update this plan with the confirmed API formats
- [x] Implement `loadRuntimeState` for Go (`GET /zen/go/v1/usage`)
- [x] Implement Zen credits from unofficial billing scrape when cookie + workspace are available
- [x] Resolve keys from env + `~/.local/share/opencode/auth.json` + Pi auth
- [x] Update `auth.ts` env keys
- [x] Update `PROVIDERS.md` and README
- [x] Typecheck

## Research summary

### OpenCode Go — official

Source: `packages/console/app/src/routes/zen/go/v1/usage.ts` in [anomalyco/opencode](https://github.com/anomalyco/opencode).

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <api-key>
```

Response:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 4, "resetsAt": "2026-08-13T16:27:38.287Z" },
    "weekly":  { "status": "ok", "percent": 3, "resetsAt": "2026-08-17T00:00:00.287Z" },
    "monthly": { "status": "ok", "percent": 1, "resetsAt": "2026-09-13T06:06:01.287Z" }
  }
}
```

- `percent` is **used** percent (`usagePercent` from LiteData).
- `status` is `"ok"` or `"rate-limited"`.
- `resetsAt` is ISO, computed as `now + resetInSec`.
- 401 = bad key. 403 `EntitlementError` = no Go subscription.
- Live probe of a local Zen `opencode` key returned 403 EntitlementError (expected: no Go plan).
- Published spend limits (docs): **$12 / 5h**, **$30 / week**, **$60 / month**. Dollar remaining is derived: `limit * (100 - percent) / 100`.

Key sources, in order:

1. `OPENCODE_GO_API_KEY`
2. `~/.local/share/opencode/auth.json` → `opencode-go.key`
3. `OPENCODE_API_KEY`
4. `~/.local/share/opencode/auth.json` → `opencode.key`
5. Pi `auth.json` → `opencode`

### OpenCode Zen — no official balance API

Live probe (2026-08-24) with a valid Zen API key:

| Endpoint | Result |
|---|---|
| `GET /zen/go/v1/usage` | 403 EntitlementError (Go-only) |
| `GET /zen/v1/usage` | 404 |
| `GET /zen/v1/balance` | 404 |
| `GET /zen/v1/credits` | 404 |
| `GET /zen/go/v1/balance` | 404 |
| `GET api.opencode.ai/v1/credits` | 200 `"Not Found"` text |
| `GET /zen/v1/models` | 200 models list |

GitHub issues [#10447](https://github.com/anomalyco/opencode/issues/10447) / [#10448](https://github.com/anomalyco/opencode/issues/10448) / [#44189](https://github.com/anomalyco/opencode/issues/44189) still request an official Zen balance endpoint.

Community tools (opencode-quota, CodexBar) scrape:

```
GET https://opencode.ai/workspace/{workspaceId}/billing
Cookie: auth=<console session cookie>
```

SSR HTML contains `billing.get` / `balance` / `monthlyLimit` / `monthlyUsage`.

Unit conversion (console `formatBalance` and opencode-quota):

- `balance` and `monthlyUsage` are **1e8 units = $1**
- `monthlyLimit` is already **dollars**

This path is **unofficial / fragile**. Label it in code, notes, and docs.

Zen scrape credentials:

- Cookie: `OPENCODE_AUTH_COOKIE` / `OPENCODE_ZEN_COOKIE` / `OPENCODE_COOKIE`
- Workspace: `OPENCODE_WORKSPACE_ID` / `OPENCODE_ZEN_WORKSPACE_ID`, or discover `wrk_…` from `https://opencode.ai/` when a cookie is present

Local `opencode.db` session costs are mixed-provider local estimates and cannot provide account remaining balance. Do not use them as Zen dollars.

### Decision

Keep a **single `opencode` provider tab**. Load both products independently:

- If Go succeeds, show 5h / Weekly / Monthly (weekly is the headline).
- If Zen scrape succeeds, show a Zen Credits window with dollars left + dollars used.
- Ready if either product returns data. Error only if both fail.

## Step-by-step implementation

1. Add `OPENCODE_API_KEY` and `OPENCODE_GO_API_KEY` to `auth.ts`.
2. Rewrite `src/extensions/core/providers/opencode.ts`:
   - Resolve keys from env + OpenCode auth file + Pi auth.
   - Fetch official Go usage; map rolling/weekly/monthly to windows.
   - Fetch unofficial Zen billing when cookie is available; map balance/used.
   - Combine windows, status, and labeled notes.
3. Update `PROVIDERS.md` with the official Go contract and unofficial Zen scrape.
4. Update README: OpenCode is implemented, document auth/env.
5. Run `npm run typecheck`.

## Validation

- Typecheck passes.
- Missing auth → clear error listing Go key + Zen cookie/workspace.
- Go 403 without Zen scrape → entitlement error, not a generic fetch failure.
- Official Go payload maps used percent → remaining % and remaining dollars.
- Zen scrape maps 1e8 units → dollars left / dollars used.

## Risks

- Go dollar remaining uses published marketing limits, not a server-provided dollar field.
- Zen scrape can break if console HTML / SolidStart SSR changes.
- A single OpenCode API key may be Zen-only (403 on Go) or Go-only.
