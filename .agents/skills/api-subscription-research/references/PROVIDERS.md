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
| Kilo Code / Kilo Gateway | Per-request `usage` in gateway responses; source-exposed `GET /api/profile`, `GET /api/profile/balance` | `KILO_API_KEY`, local Kilo auth (`~/.local/share/kilo/auth.json`), or legacy `~/.kilocode/cli/config.json` token | Mixed: official per-request usage, source-exposed balance/profile endpoints | Best current fit is a balance-centric provider tab; stable public aggregate usage API not yet confirmed |
| Exa | `GET https://admin-api.exa.ai/team-management/api-keys/{id}/usage` (+ team-management key listing) | Exa service API key | Official team-management API | Good for API-key/team usage and billing analytics; no public remaining-balance / credits-left API found |
| Parallel Search | `Platform > Usage` dashboard (no documented usage API found) | Parallel API key for request APIs; dashboard account for the usage UI | Console-only / no public usage API found | Official docs expose pricing and dashboard usage/spend, but not an API endpoint for balance, credits left, or spend retrieval |
| OpenCode Go / Zen | Go docs + dashboard page `https://opencode.ai/workspace/{workspaceId}/go`; Zen docs + local `opencode stats` | OpenCode API key for official model endpoints; browser `auth` cookie + workspace id for Go dashboard; local CLI/auth for Zen stats | Mixed: official docs for limits/models, unofficial for live usage | Go usage can be scraped from the dashboard page; Zen still has no clearly documented public usage/credits API |
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
- primary and secondary rate-limit windows, often matching 5h / 7d style usage
- credits balance
- spend-control flags

**Stability**
- treat as **unofficial / reverse-engineered**
- appropriate only for end-user subscription style features

**Important distinction**
- OpenAI’s official Admin APIs are for org usage and spend
- ChatGPT / Codex end-user subscription counters appear to require internal product endpoints instead

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

#### OpenCode Go live usage: dashboard page scrape (**unofficial**)

A working implementation pattern exists in adjacent tooling:
- request `GET https://opencode.ai/workspace/{workspaceId}/go`
- authenticate with the browser/session cookie header `Cookie: auth=<cookie>`
- parse the rendered page / embedded Next.js payload for:
  - `rollingUsage.usagePercent`
  - `rollingUsage.resetInSec`
  - `weeklyUsage.usagePercent`
  - `weeklyUsage.resetInSec`
  - `monthlyUsage.usagePercent`
  - `monthlyUsage.resetInSec`

**Required auth/material**
- OpenCode Go API key is still useful for validating access against `GET https://opencode.ai/zen/go/v1/models`
- but live usage needs:
  - OpenCode browser `auth` cookie
  - workspace id (`wrk_...`)

**Likely sources for those values**
- browser cookies for `opencode.ai`
- recent visits to `/workspace/{workspaceId}/go`
- optional local config file or env overrides if this repo chooses to support them

**Stability**
- treat this as **unofficial / fragile**
- it is HTML / app-payload scraping, not a documented JSON quota API

#### OpenCode Zen live usage: no clearly documented public usage API yet

Current official docs document models and pricing, but not a public JSON usage/credits endpoint for end-user Zen balance or spend.

Two practical-but-imperfect options are currently known:

1. **Local CLI stats**
   - run `opencode stats --days 7 --models`
   - filter rows for `opencode/` and optionally `opencode-go/` model prefixes
   - this gives local observed cost/session history, not authoritative server-side remaining balance

2. **Legacy / unverified credits endpoint candidate**
   - `GET https://api.opencode.ai/v1/credits`
   - bearer auth with the OpenCode API key
   - observed only in third-party code; the same code explicitly treats `404` and even HTTP `200` with body `Not Found` as signs the endpoint is unavailable
   - because it is not in current official docs, treat it as **unofficial / possibly deprecated / unverified**

### Practical implication for this repo

The safest current position is:
- **OpenCode Go** can be implemented with documented static limits plus an **unofficial dashboard scrape** for live 5h/weekly/monthly usage
- **OpenCode Zen** should be treated as either:
  - a local CLI-stats-backed approximation, or
  - an informational/pay-as-you-go provider until a documented balance/usage API is confirmed

Do **not** present either source as a stable official usage API unless OpenCode publishes one.

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
9. **OpenCode** — wait for a clearly documented usage API or ship as informational-only first.
10. **Parallel Search** — currently dashboard-only for usage/spend visibility unless an unofficial dashboard endpoint is intentionally adopted.

---

## Summary for future coding work

If the product goal is **stable, documented, low-risk integrations**, start with OpenRouter, Exa, and official org/admin APIs.

If the product goal is **personal subscription meters like Claude Pro/Max, ChatGPT Plus/Pro, Codex, or personal Copilot quota counters**, expect private or reverse-engineered endpoints and build those behind explicit labels and careful error handling.

For **Parallel Search**, the current safe position is dashboard-only until a documented usage/billing API appears or the project explicitly accepts an unofficial integration path.
