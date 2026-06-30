# OpenCode Go / Zen usage integration

- **Status:** planned
- **Date:** 2026-06-30
- **Owner:** agent

## Objective

Implement the best currently available OpenCode subscription/usage support for this repository, using officially documented sources where possible and clearly labeling any unofficial dashboard or local-CLI scraping paths.

## Research summary

### OpenCode Go

**Officially documented**
- Auth storage: `~/.local/share/opencode/auth.json`
- Console: `https://opencode.ai/auth`
- Limits:
  - 5h: `$12`
  - Weekly: `$30`
  - Monthly: `$60`
- Official model endpoints:
  - `GET https://opencode.ai/zen/go/v1/models`
  - `POST https://opencode.ai/zen/go/v1/chat/completions`
  - `POST https://opencode.ai/zen/go/v1/messages`

**Best known live-usage source**
- `GET https://opencode.ai/workspace/{workspaceId}/go`
- Auth: `Cookie: auth=<session-cookie>`
- Parse embedded app payload for:
  - `rollingUsage.usagePercent`
  - `rollingUsage.resetInSec`
  - `weeklyUsage.usagePercent`
  - `weeklyUsage.resetInSec`
  - `monthlyUsage.usagePercent`
  - `monthlyUsage.resetInSec`
- Stability: **unofficial / fragile** (HTML/app-payload scraping, not a documented JSON quota API)

### OpenCode Zen

**Officially documented**
- Pay-as-you-go credits
- Per-model pricing in docs
- Auto-reload when balance falls below `$5`
- Workspace and member monthly usage limits configurable in the console
- Official model endpoints:
  - `GET https://opencode.ai/zen/v1/models`
  - `POST https://opencode.ai/zen/v1/responses`
  - `POST https://opencode.ai/zen/v1/messages`
  - `POST https://opencode.ai/zen/v1/chat/completions`

**Best known usage options today**
1. Local CLI stats:
   - `opencode stats --days 7 --models`
   - filter `opencode/` and `opencode-go/` rows
   - gives local observed spend history, not authoritative server-side remaining balance
2. Legacy/unverified endpoint candidate:
   - `GET https://api.opencode.ai/v1/credits`
   - bearer auth with the OpenCode API key
   - seen only in third-party code and may return `404` or `200 Not Found`
   - treat as **unofficial / possibly deprecated / unverified**

## Implementation decision

Ship OpenCode in two layers:

1. **OpenCode Go:** implement documented static limits plus an **unofficial dashboard scrape** for live 5h/weekly/monthly percentages.
2. **OpenCode Zen:** keep the provider clearly labeled as **informational or approximate** unless a stable balance/usage API is confirmed. If we add live data, prefer the local `opencode stats` CLI path over the unverified `api.opencode.ai` endpoint.

## Checklist

- [ ] Confirm where this extension should read OpenCode credentials from (`AuthStorage` vs direct `~/.local/share/opencode/auth.json` parsing).
- [ ] Implement OpenCode Go auth/key discovery.
- [ ] Implement OpenCode Go official model-list validation via `GET /zen/go/v1/models`.
- [ ] Implement OpenCode Go dashboard usage fetch/parsing from `/workspace/{workspaceId}/go`.
- [ ] Decide how Go dashboard credentials are supplied in this repo (env vars, local config file, or future settings UI).
- [ ] Implement runtime-state mapping for Go 5h/weekly/monthly windows.
- [ ] Decide whether Zen launches as informational-only or with local `opencode stats` approximation.
- [ ] If Zen approximation is enabled, implement CLI execution + parsing with timeouts and defensive error handling.
- [ ] Update provider copy/notes/UI messaging to distinguish official vs unofficial data sources.
- [ ] Add tests for Go payload parsing and any Zen parsing helpers.
- [ ] Run `npm run typecheck`.

## Detailed implementation plan

1. **Credential strategy**
   - Inspect whether Pi `AuthStorage` already knows OpenCode/OpenCode Go entries.
   - If not, add a small local reader for `~/.local/share/opencode/auth.json` and extract:
     - `opencode.key`
     - `opencode-go.key`
   - Keep secrets in memory only; never log raw keys/cookies.

2. **OpenCode Go phase**
   - In `src/extensions/core/providers/opencode.ts`, replace the scaffold-only runtime with a real `loadRuntimeState` implementation.
   - Validate the Go API key against `GET https://opencode.ai/zen/go/v1/models` to confirm the credential is valid and optionally count models.
   - Add a second fetch step for `GET https://opencode.ai/workspace/{workspaceId}/go` using `Cookie: auth=<cookie>`.
   - Parse `rollingUsage`, `weeklyUsage`, and `monthlyUsage` plus their `resetInSec` values from the returned HTML/app payload.
   - Convert those into `SubscriptionUsageWindowDefinition[]` with labels `5h`, `Weekly`, and `Monthly`.
   - If dashboard credentials are missing, return a partial/informational runtime state that still shows the documented Go limits and explains what extra auth is needed for live usage.

3. **Go dashboard credential input**
   - Short term: support env/config inputs only, for example a repo-specific config file or environment variables such as:
     - `OPENCODE_GO_WORKSPACE_ID`
     - `OPENCODE_GO_AUTH_COOKIE`
   - Do **not** block the whole provider on adding a text-entry settings UI unless product requirements demand it.
   - If a future UI path is wanted, plan that separately because current settings are global toggles only and do not yet support secure provider-specific text fields.

4. **OpenCode Zen phase**
   - Keep the current official-doc facts in the provider description: pay-as-you-go pricing, auto-reload, monthly limits in the console.
   - Prefer one of two paths:
     - **Safe initial path:** informational-only Zen provider with docs/notes and no false promise of live remaining balance.
     - **Approximation path:** run `opencode stats --days 7 --models`, filter `opencode/` rows, and show local spend/model breakdown as approximate usage.
   - Do **not** rely on `https://api.opencode.ai/v1/credits` unless it is re-verified during implementation and explicitly labeled unofficial/deprecated-risky.

5. **UI and messaging**
   - Update `description`, `authHint`, `usageHint`, and `notes` so the user can tell:
     - Go limits are official but live usage is from an unofficial dashboard scrape.
     - Zen live data, if any, is local/approximate unless a real API is later confirmed.
   - Keep `stability` as `mixed` or `unknown` rather than `official`.

6. **Testing**
   - Add unit tests for Go HTML/app-payload parsing using captured fixture snippets containing `rollingUsage`, `weeklyUsage`, and `monthlyUsage`.
   - If Zen CLI parsing is added, test against representative sample output and failure modes.
   - Ensure error states are useful when:
     - key is missing
     - workspace id/cookie are missing
     - dashboard schema changes
     - CLI is unavailable

7. **Validation**
   - Run `npm run typecheck`.
   - Manually verify the provider shows:
     - Go documented limits even without dashboard credentials
     - live 5h/weekly/monthly windows when dashboard credentials are supplied
     - clear messaging for Zen informational/approximate mode

## Risks / questions

- This repo currently has no obvious secure provider-specific text input flow for storing a browser auth cookie; env/config may be the safest initial path.
- The Go dashboard path is not an official API and may break when OpenCode changes page structure.
- Zen still lacks a clearly documented balance/usage endpoint, so a fully accurate “remaining credits” meter may not be possible yet.
- `opencode stats` is local-history based and may not match server-side billing perfectly.
- We should avoid claiming official support for any OpenCode usage endpoint beyond the documented model APIs and published limits.

## Validation

- `npm run typecheck`
- Manual verification against a real OpenCode Go account with dashboard credentials
- Confirm degraded but informative behavior when only the API key is available
- Confirm Zen wording stays honest about approximation / missing official usage API
