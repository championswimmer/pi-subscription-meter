# Provider usage / subscription research

This reference captures the current known ways to retrieve subscription, quota, billing, or usage information for the initial provider set.

Detailed endpoint-by-endpoint request/response schema inventory:
- `.agents/plans/2026-06-29-provider-api-inventory.md`

## Quick matrix

| Provider | Best documented source | Token type | Stability | Notes |
| --- | --- | --- | --- | --- |
| Anthropic | `/v1/organizations/usage_report/messages` | Anthropic **Admin API key** | Official admin API | Good for org/workspace usage and cost analytics, not end-user Pro/Max limits |
| Anthropic (user subscription style) | `/api/oauth/usage` | OAuth bearer token | Unofficial / product-specific | Useful for Claude Pro/Max-style windows like 5h / 7d |
| OpenAI | `/organization/costs`, `/organization/usage/*` | OpenAI **Admin API key** | Official admin API | Good for org usage and spend, not ChatGPT Plus/Pro subscription counters |
| OpenAI / ChatGPT / Codex | `https://chatgpt.com/backend-api/wham/usage` | ChatGPT/Codex bearer token + account id | Unofficial / reverse-engineered | Useful for end-user subscription usage windows |
| OpenRouter | `/api/v1/key`, `/api/v1/credits` | OpenRouter API key | Official | Easiest provider to support for credit + budget usage |
| xAI SuperGrok | `GET https://cli-chat-proxy.grok.com/v1/user`, then `GET /v1/billing?format=credits` | Pi `/login xai` OAuth bearer with `grok-cli:access` scope | Unofficial / product-specific | Reuse the validated `userId` only as the `x-userid` request header; returns a shared weekly period and may return usage percentages or product breakdowns |
| Kilo Code / Kilo Gateway | Per-request `usage` in gateway responses; source-exposed `GET /api/profile`, `GET /api/profile/balance` | `KILO_API_KEY`, local Kilo auth (`~/.local/share/kilo/auth.json`), or legacy `~/.kilocode/cli/config.json` token | Mixed: official per-request usage, source-exposed balance/profile endpoints | Best current fit is a balance-centric provider tab; stable public aggregate usage API not yet confirmed |
| Exa | `GET https://admin-api.exa.ai/team-management/api-keys/{id}/usage` (+ team-management key listing) | Exa service API key | Official team-management API | Good for API-key/team usage and billing analytics; no public remaining-balance / credits-left API found |
| Parallel Search | `Platform > Usage` dashboard (no documented usage API found) | Parallel API key for request APIs; dashboard account for the usage UI | Console-only / no public usage API found | Official docs expose pricing and dashboard usage/spend, but not an API endpoint for balance, credits left, or spend retrieval |
| OpenCode Go / Zen | Official `GET https://opencode.ai/zen/go/v1/usage` for Go; unofficial `GET https://opencode.ai/workspace/{workspaceId}/billing` scrape for Zen dollars | OpenCode API key (`opencode` / `opencode-go` in `~/.local/share/opencode/auth.json`, `OPENCODE_API_KEY`, `OPENCODE_GO_API_KEY`) for Go; browser `auth` cookie + workspace id for Zen billing | Mixed: official Go usage API, unofficial Zen billing scrape | Go returns used percent for 5h / weekly / monthly. Zen still has no official balance API (`/zen/v1/balance` 404s). |
| GitHub Copilot org / enterprise | `orgs/{org}/copilot/billing`, `.../seats`, enterprise equivalents | GitHub token with org/enterprise billing permissions | Official preview APIs | Good for org/enterprise billing + seat state |
| GitHub Copilot end-user counters | `api.github.com/copilot_internal/*` | GitHub OAuth token / exchanged Copilot token | Unofficial / internal | Useful for personal monthly counters and entitlement snapshots |

---

## Cross-provider implementation rules

1. **Prefer official APIs first.**
2. **Use the user’s existing token store if possible.** In a Pi extension, prefer already-connected provider credentials through Pi auth storage.
3. **Clearly label unofficial endpoints.** They can break without notice.
4. **Do not log secrets.** Mask tokens in errors, logs, and UI.
5. **Be honest about access level.** Many official endpoints require org admin or billing-manager privileges and will not work for normal end users.

---

## Pi-extension auth strategy

When implementing this inside a Pi extension, use the user’s already connected credentials whenever possible.

Recommended order:

1. Read provider credentials from Pi auth storage.
2. If a provider requires additional metadata, read only the minimum extra value needed.
3. Fall back to environment variables only when no connected auth exists.
4. Only ask the user for manual token entry if neither auth storage nor env vars are available.

Likely useful env vars if manual fallback is ever needed:
- `ANTHROPIC_ADMIN_KEY`
- `OPENAI_ADMIN_KEY`
- `OPENROUTER_API_KEY`
- `EXA_API_KEY`
- `PARALLEL_API_KEY`
- `GITHUB_TOKEN`
- provider-specific OpenCode keys if later needed

---

## Anthropic

### Official admin usage source

Use the Anthropic Usage & Cost Admin API.

**Documented endpoint**
- `GET https://api.anthropic.com/v1/organizations/usage_report/messages`

**What it gives**
- time-bucketed usage reports
- filtering by account, API key, workspace, model, service tier, context window, etc.
- suitable for organization analytics and cost reporting

**Auth**
- `x-api-key: <ANTHROPIC_ADMIN_KEY>`
- `anthropic-version: 2023-06-01`
- some features may require `anthropic-beta` headers

**When to use**
- workspace or organization billing dashboards
- admin-level usage views

**When not to use**
- end-user Claude Pro/Max subscription windows

### End-user subscription-style source

There is a product-specific usage endpoint used by existing tooling.

**Endpoint**
- `GET https://api.anthropic.com/api/oauth/usage`

**Auth**
- `Authorization: Bearer <oauth-access-token>`
- `anthropic-beta: oauth-2025-04-20`
- `Accept: application/json`

**Important auth distinction**
- a normal `ANTHROPIC_API_KEY` is **not** the same thing as the Claude product OAuth bearer token required here
- live implementation validation on 2026-06-29 confirmed that presenting `ANTHROPIC_API_KEY` as a bearer token to `/api/oauth/usage` returns `Invalid bearer token`
- for a personal Claude subscription meter, prefer Pi-managed Claude `/login` auth rather than the standard Anthropic API key

**What it appears to return**
- 5 hour utilization windows
- 7 day utilization windows
- sometimes model-specific weekly windows
- extra usage / overage budget info

**Stability**
- treat this as **unofficial / product-specific**
- useful for Claude subscription-style meters
- do not assume long-term stability

**Implementation note**
- this is the better fit if the feature goal is “show my Claude subscription remaining capacity,” not admin usage analytics

---

## OpenAI / ChatGPT / Codex

### Official admin usage + spend sources

OpenAI provides Admin APIs for organization administration and spend/usage analytics.

**Documented endpoints**
- `GET /organization/costs`
- `GET /organization/usage/completions`
- other `organization/usage/*` endpoints for embeddings, images, audio, vector stores, file searches, web searches, etc.

**Common documented query params**
- `start_time`
- `end_time`
- `bucket_width`
- `group_by`
- `limit`
- `page`

**Auth**
- OpenAI **Admin API key**
- SDKs typically use `adminAPIKey`, or raw HTTP can use `Authorization: Bearer <OPENAI_ADMIN_KEY>`

**What it gives**
- spend by time bucket
- aggregated usage by API key, project, user, model, line item, and more
- paginated `data[]` bucket responses with `has_more` / `next_page`

**When to use**
- API usage dashboards for organizations
- finance/billing summaries

**When not to use**
- ChatGPT Plus/Pro-style personal subscription usage meters

### End-user ChatGPT / Codex source

Existing quota tools use an internal ChatGPT endpoint for user subscription usage.

**Endpoint**
- `GET https://chatgpt.com/backend-api/wham/usage`

**Auth**
- `Authorization: Bearer <chatgpt-access-token>`
- `ChatGPT-Account-Id: <account-id>`
- browser-like headers such as `Origin`, `Referer`, `Accept`, `User-Agent`

**Extra metadata needed**
- account id is commonly required in addition to the bearer token
- one known local source is `~/.codex/auth.json`

**What it appears to return**
- percentage-based rate-limit windows from the ChatGPT/Codex product meter
- credits balance
- spend-control flags

**Observed response nuances**
- live validation on 2026-07-26 for a Plus account returned `rate_limit.primary_window` with `used_percent`, `reset_at`, `reset_after_seconds`, and `limit_window_seconds: 604800` (7 days)
- that same live response returned `secondary_window: null`, so the endpoint currently may expose a weekly window only
- older reverse-engineered samples and some third-party tools still show both 5h/session and 7d/weekly windows, so treat the schema as account- and rollout-dependent
- do not assume `primary_window` always means 5-hour/session; inspect `limit_window_seconds` when present

**Stability**
- treat as **unofficial / reverse-engineered**
- appropriate only for end-user subscription style features

**Important distinction**
- OpenAI’s official Admin APIs are for org usage and spend
- ChatGPT / Codex end-user subscription counters appear to require internal product endpoints instead
- official Codex pricing docs say the underlying meter is driven by token/credit consumption, so the percentage shown by `wham/usage` is not a simple message count and can vary with model, context size, reasoning, tool use, caching, and cloud vs local execution

---

## xAI SuperGrok

### Personal subscription usage source

**Endpoint sequence (undocumented / product-specific)**
1. `GET https://cli-chat-proxy.grok.com/v1/user`
2. Validate the returned printable-ASCII `userId`, then call `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with that value in `x-userid`.

**Auth and headers**
- `Authorization: Bearer <Pi xAI OAuth access token>`
- Grok CLI proxy headers observed from current working integrations:
  - `x-grok-client-identifier: grok-shell`
  - `x-grok-client-version: 0.2.101`
  - `x-grok-client-mode: interactive`
  - `X-XAI-Token-Auth: xai-grok-cli`
  - `x-authenticateresponse: authenticate-response`
- Pi’s built-in `/login xai` OAuth flow uses client id `b1a00492-073a-47ea-816f-4c329264a828` and requests `grok-cli:access` plus `api:access`; Pi stores the resulting OAuth credential under `xai` in `~/.pi/agent/auth.json` and owns refresh.
- `XAI_API_KEY` is for billed xAI API access and must **not** be treated as a SuperGrok subscription-quota credential.

**Observed response fields**
- `config.currentPeriod.type`, `start`, `end`; current paid accounts return `USAGE_PERIOD_TYPE_WEEKLY` for the shared pool.
- When supplied: `config.creditUsagePercent`, `config.productUsage[].product`, and `config.productUsage[].usagePercent`.
- Other observed fields include `config.billingPeriodStart`, `billingPeriodEnd`, `isUnifiedBillingUser`, `onDemandCap`, `onDemandUsed`, and `prepaidBalance`.

**Validation and caveats**
- A safe live validation on 2026-08-24 using this repository’s Pi-managed xAI OAuth credential returned HTTP 200 from both proxy calls and a weekly `currentPeriod` with valid bounds. That account’s response omitted `creditUsagePercent` and `productUsage`, so an implementation must report the active period without inventing `0%` usage.
- The direct consumer gRPC-web RPC `POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` accepted the same bearer but returned an empty body in that validation. Do not depend on it for this integration.
- Treat the proxy endpoints as **unofficial** and expect account/rollout-specific fields or breakage. Do not log the user id, bearer token, or raw billing body.

**Implementation sources**
- Pi’s current xAI OAuth flow: installed `@earendil-works/pi-ai/dist/auth/oauth/xai.js`.
- Proxy request and defensive response shape: <https://github.com/stnly/pi-grok/blob/main/usage.ts> and <https://github.com/stnly/pi-grok/blob/main/account.ts>.
- xAI’s official product FAQ describes one shared paid weekly pool across Grok products, but does not document the API endpoint: <https://docs.x.ai/grok/faq>.

---

## OpenRouter

OpenRouter is one of the cleanest providers to support.

### Current key usage

**Documented endpoint**
- `GET https://openrouter.ai/api/v1/key`

**Auth**
- `Authorization: Bearer <OPENROUTER_API_KEY>`

**Useful fields**
- `limit`
- `limit_remaining`
- `usage_daily`
- `usage_weekly`
- `usage_monthly`

**Use cases**
- daily / weekly / monthly spend display
- monthly budget meters
- remaining key budget

### Remaining credits

**Documented endpoint**
- `GET https://openrouter.ai/api/v1/credits`

**Auth**
- `Authorization: Bearer <OPENROUTER_API_KEY>`

**Useful fields**
- `data.total_credits`
- `data.total_usage`

**Auth note**
- docs indicate a **management key** is required for `/api/v1/credits`
- local implementation validation on 2026-06-29 succeeded with the currently configured OpenRouter key and returned `total_credits` + `total_usage`; treat this as observed behavior, while still preferring the docs as the conservative expectation

**Implementation guidance**
- use `/api/v1/key` for key-scoped daily / weekly / monthly usage and optional per-key budget data
- use `/api/v1/credits` to compute total remaining purchased credits as `total_credits - total_usage`
- for the best end-user OpenRouter tab, combine both endpoints when `/api/v1/credits` is available

---

## Kilo Code / Kilo Gateway

### Officially documented request-level usage

**Documented behavior**
- Kilo Gateway includes per-request usage in API responses.
- non-streaming responses include a `usage` field in the response body
- streaming responses include usage in the final SSE chunk before `[DONE]`

**Documented usage fields**
- `model`
- `provider`
- `input_tokens`
- `output_tokens`
- `cache_write_tokens`
- `cache_hit_tokens`
- `cost_microdollars`
- `time_to_first_token`
- `is_byok`

### Source-exposed account balance / profile endpoints

**Observed in first-party open-source client code**
- `GET https://api.kilo.ai/api/profile`
- `GET https://api.kilo.ai/api/profile/balance`

**Auth**
- `Authorization: Bearer <token>`
- optional `x-kilocode-organizationid: <orgId>` for org/team balance context

**Credential sources confirmed during research**
- `KILO_API_KEY`
- local Kilo auth: `~/.local/share/kilo/auth.json`
- legacy config fallback: `~/.kilocode/cli/config.json`

**What it gives today**
- profile identity data
- optional organizations / org context when available
- current credit balance via `/api/profile/balance`
- observed live response fields on 2026-06-30 included `balance` and `isDepleted`

**What it does not yet clearly give**
- no confirmed stable public aggregate usage API for daily/weekly/monthly spend retrieval
- no confirmed stable public API for total purchased credits / lifetime credit top-ups

**Implementation guidance**
- treat Kilo as a **balance-centric** provider first
- show credits remaining and account/depleted state
- label `/api/profile` and `/api/profile/balance` as **source-exposed** rather than fully documented public usage APIs
- if a stable analytics endpoint is later confirmed, extend the provider to show richer spend windows

---

## Exa

### Official per-key usage / billing analytics

**Documented endpoints**
- `GET https://admin-api.exa.ai/team-management/api-keys/{id}/usage`
- related key discovery endpoints:
  - `GET https://admin-api.exa.ai/team-management/api-keys`
  - `GET https://admin-api.exa.ai/team-management/api-keys/{id}`

**Auth**
- Exa docs describe a **service API key for team authentication** for these team-management endpoints
- re-check the live docs for the exact header shape during implementation; the docs clearly require a team/service key, but the excerpts captured here did not preserve the header example verbatim

**What it gives**
- authoritative usage analytics and billing data for a specific API key
- `period.start` / `period.end`
- `total_cost_usd`
- `cost_breakdown[]` with price id/name, quantity, and `amount_usd`
- `metadata.generated_at`

**Documented request inputs**
- path param: API key `id`
- optional time range params such as `start_date` and `end_date`
- optional `group_by`
- default period appears to be the last 30 days

**Lookback caveat**
- search/doc excerpts captured during research showed conflicting historical limits (`100` vs `180` days)
- re-verify the live docs before coding and treat the published endpoint page as the final authority

**Best fit**
- team-level or key-level spend analytics
- daily / weekly / monthly spend windows derived from recent-period queries

**What it does not appear to give**
- no documented API for current account credit balance / remaining credits
- Exa’s billing docs say the remaining balance is visible on the dashboard billing page

**Implementation guidance**
- if only a raw `EXA_API_KEY` is available, prefer listing team keys first and then either:
  - aggregate usage across keys, or
  - let the user specify/select a single API key id
- ship Exa as an **official usage/spend provider**, not a direct credits-left meter, unless a public balance API is later confirmed

---

## Parallel Search

### Official usage / billing sources

**What the docs currently say**
- API keys are created in the Parallel Platform
- usage and costs are tracked in **Platform > Usage**
- pricing docs define request-cost formulas for Search, Extract, Chat, Task, FindAll, Entity Search, and Monitor

**Documented API surface found**
- request APIs such as Search are documented and authenticated with `x-api-key`
- no documented `/usage`, `/billing`, `/credits`, or remaining-balance endpoint was found in the official docs during this research pass

**Best fit**
- dashboard-only manual usage/spend inspection today

**What it does not appear to give**
- no public API for real-time spend retrieval
- no public API for remaining credits / balance
- no public API for billing history

**Observed runtime behavior**
- Parallel request APIs can return `402` insufficient credit when the account is out of funds
- that is useful as an error signal, but it is not a documented balance endpoint

**Implementation guidance**
- treat Parallel as dashboard-only unless the product explicitly accepts private or reverse-engineered dashboard endpoints
- if live integration is later pursued, isolate it behind explicit unofficial labeling and defensive error handling

---

## OpenCode

### What is documented

OpenCode’s docs clearly document:
- how users connect providers
- where auth is stored
- the official model endpoints for Zen and Go
- that OpenCode Go usage can be tracked in the console
- the published OpenCode Go subscription limits
- Zen pricing, auto-reload behavior, and workspace/member monthly spend limits

**Auth storage**
- `~/.local/share/opencode/auth.json`

**Console**
- `https://opencode.ai/auth`

**OpenCode Go documented limits**
- 5 hour limit: `$12` of usage
- weekly limit: `$30` of usage
- monthly limit: `$60` of usage

**OpenCode Go documented model endpoints**
- `https://opencode.ai/zen/go/v1/chat/completions`
- `https://opencode.ai/zen/go/v1/messages`
- model list: `https://opencode.ai/zen/go/v1/models`

**OpenCode Zen documented model endpoints**
- `https://opencode.ai/zen/v1/responses`
- `https://opencode.ai/zen/v1/messages`
- `https://opencode.ai/zen/v1/chat/completions`
- model list: `https://opencode.ai/zen/v1/models`

**OpenCode Zen documented billing behavior**
- pay-as-you-go credits
- auto-reload when balance falls below `$5`
- configurable monthly usage limits for the workspace and for each member

### Best currently known programmatic usage sources

#### OpenCode Go live usage: official JSON endpoint

Source in OpenCode console: `packages/console/app/src/routes/zen/go/v1/usage.ts`.

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
- `resetsAt` is ISO (`now + resetInSec`).
- 401 = bad key. 403 `EntitlementError` = no Go subscription.
- The API does **not** return dollar remaining. Published limits are `$12` / 5h, `$30` / week, `$60` / month.
- A Zen-only API key against this endpoint returns 403.

**Key sources**
- `OPENCODE_GO_API_KEY`
- `~/.local/share/opencode/auth.json` → `opencode-go.key`
- `OPENCODE_API_KEY`
- `~/.local/share/opencode/auth.json` → `opencode.key`
- Pi `auth.json` → `opencode`

**Stability**
- official product API (Bearer API key)
- not prominently documented on the public Go docs page, but the route is first-party console source

#### OpenCode Zen live usage: unofficial billing scrape (no official API yet)

Live probe (2026-08-24) of a valid Zen API key:

| Endpoint | Result |
| --- | --- |
| `GET /zen/v1/usage` | 404 |
| `GET /zen/v1/balance` | 404 |
| `GET /zen/v1/credits` | 404 |
| `GET /zen/go/v1/balance` | 404 |
| `GET https://api.opencode.ai/v1/credits` | 200 with body `Not Found` |
| `GET /zen/v1/models` | 200 models list |

GitHub issues [#10447](https://github.com/anomalyco/opencode/issues/10447), [#10448](https://github.com/anomalyco/opencode/issues/10448), and [#44189](https://github.com/anomalyco/opencode/issues/44189) still request an official Zen balance endpoint.

Community tools scrape the workspace billing page:

```
GET https://opencode.ai/workspace/{workspaceId}/billing
Cookie: auth=<console session cookie>
```

Parse SSR HTML / `billing.get` for `balance`, `monthlyLimit`, `monthlyUsage`.

Unit conversion (console `formatBalance` and community parsers):
- `balance` and `monthlyUsage` are **1e8 units = $1**
- `monthlyLimit` is already **dollars**

**Required auth/material**
- `OPENCODE_AUTH_COOKIE` / `OPENCODE_ZEN_COOKIE` / `OPENCODE_COOKIE`
- `OPENCODE_WORKSPACE_ID` / `OPENCODE_ZEN_WORKSPACE_ID` (`wrk_...`), or discover it from `https://opencode.ai/` when a cookie is present

**Local CLI stats are not a remaining-balance source**
- `opencode stats` / `opencode.db` session costs are mixed-provider local estimates
- they cannot provide account remaining dollars

**Stability**
- treat Zen billing scrape as **unofficial / fragile**
- do not present it as an official usage API

### Practical implication for this repo

- **OpenCode Go** should use the official `/zen/go/v1/usage` JSON API and derive remaining dollars from published limits.
- **OpenCode Zen** can show dollars left / dollars used only via the unofficial billing scrape until OpenCode ships `/zen/v1/balance` or equivalent.
- A single OpenCode tab can load both products independently and stay ready if either succeeds.

---

## GitHub Copilot

GitHub Copilot has both official org/enterprise billing APIs and unofficial end-user usage endpoints.

### Official org / enterprise APIs

**Organization endpoints**
- `GET https://api.github.com/orgs/{org}/copilot/billing`
- `GET https://api.github.com/orgs/{org}/copilot/billing/seats`
- `GET https://api.github.com/orgs/{org}/members/{username}/copilot`

**Enterprise equivalents**
- `GET https://api.github.com/enterprises/{enterprise}/copilot/billing/seats`
- `GET https://api.github.com/enterprises/{enterprise}/members/{username}/copilot`

**Auth**
- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10`

**Permissions**
- classic PATs typically need `manage_billing:copilot`, `read:org`, `read:enterprise`, or admin scopes depending on endpoint
- some org endpoints also work with fine-grained PATs or GitHub App tokens when they have the right org permissions

**What these give**
- seat counts and billing state
- per-user seat assignment details
- recent activity telemetry metadata
- org/enterprise configuration summaries
- downloadable daily / 28-day metrics reports via `.../copilot/metrics/reports/...`

**Best fit**
- team/org subscription meters
- enterprise dashboards

### End-user monthly counters

Existing quota tools also use internal GitHub Copilot endpoints.

**Endpoints**
- `GET https://api.github.com/copilot_internal/v2/token`
- `GET https://api.github.com/copilot_internal/user`

**Observed auth patterns**
- a GitHub OAuth token may be exchanged for a Copilot token via `copilot_internal/v2/token`
- the user endpoint can also work with certain GitHub bearer or token auth forms depending on token type
- a practical fallback is the token from `gh auth token`

**Observed headers**
- GitHub Copilot / editor identity headers such as:
  - `User-Agent: GitHubCopilotChat/<version>`
  - `Editor-Version: vscode/<version>`
  - `Editor-Plugin-Version: copilot-chat/<version>`
  - `Copilot-Integration-Id: vscode-chat`

**What it appears to return**
- monthly quota snapshots
- entitlements and remaining counters
- premium interactions / chat / completions windows
- reset date and overage hints
- in live validation on 2026-06-29, `premium_interactions` was finite while `chat` was reported as `unlimited` on an `individual_pro` plan

**Stability**
- treat as **unofficial / internal**
- useful for personal quota meters
- likely more fragile than org billing endpoints

### Token sources

Useful possible sources for GitHub tokens in adjacent tooling:
- Pi auth storage
- `gh auth token`
- OpenCode-detected Copilot credentials from:
  - `~/.config/github-copilot/hosts.json`
  - `~/.config/github-copilot/apps.json`
  - corresponding XDG paths
- `GITHUB_TOKEN`

---

## Recommended implementation priority for this repository

1. **OpenRouter** — best official API surface for a first provider.
2. **Exa** — official usage analytics are available, but they are spend-oriented and do not expose a documented credits-left API.
3. **GitHub Copilot org/enterprise billing** — official if the user has the right token/permissions.
4. **OpenAI admin usage/costs** — official for org dashboards.
5. **Anthropic admin usage** — official for org dashboards.
6. **Anthropic user subscription** — valuable, but unofficial.
7. **OpenAI/ChatGPT/Codex user subscription** — valuable, but unofficial.
8. **GitHub Copilot personal counters** — valuable, but unofficial.
9. **OpenCode** — official Go `/zen/go/v1/usage` plus unofficial Zen billing scrape for dollars left/used.
10. **Parallel Search** — currently dashboard-only for usage/spend visibility unless an unofficial dashboard endpoint is intentionally adopted.

---

## Summary for future coding work

If the product goal is **stable, documented, low-risk integrations**, start with OpenRouter, Exa, and official org/admin APIs.

If the product goal is **personal subscription meters like Claude Pro/Max, ChatGPT Plus/Pro, Codex, or personal Copilot quota counters**, expect private or reverse-engineered endpoints and build those behind explicit labels and careful error handling.

For **Parallel Search**, the current safe position is dashboard-only until a documented usage/billing API appears or the project explicitly accepts an unofficial integration path.
