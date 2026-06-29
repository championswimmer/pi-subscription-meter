# Provider usage / subscription research

This reference captures the current known ways to retrieve subscription, quota, billing, or usage information for the initial provider set.

## Quick matrix

| Provider | Best documented source | Token type | Stability | Notes |
| --- | --- | --- | --- | --- |
| Anthropic | `/v1/organizations/usage_report/messages` | Anthropic **Admin API key** | Official admin API | Good for org/workspace usage and cost analytics, not end-user Pro/Max limits |
| Anthropic (user subscription style) | `/api/oauth/usage` | OAuth bearer token | Unofficial / product-specific | Useful for Claude Pro/Max-style windows like 5h / 7d |
| OpenAI | `/organization/costs`, `/organization/usage/*` | OpenAI **Admin API key** | Official admin API | Good for org usage and spend, not ChatGPT Plus/Pro subscription counters |
| OpenAI / ChatGPT / Codex | `https://chatgpt.com/backend-api/wham/usage` | ChatGPT/Codex bearer token + account id | Unofficial / reverse-engineered | Useful for end-user subscription usage windows |
| OpenRouter | `/api/v1/key`, `/api/v1/credits` | OpenRouter API key | Official | Easiest provider to support for credit + budget usage |
| OpenCode Go / Zen | Console at `https://opencode.ai/auth` | OpenCode API key / session auth | Partly documented, no stable public usage API found | Limits are documented, usage API is not clearly documented |
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

**Auth**
- OpenAI **Admin API key**
- SDKs typically use `adminAPIKey`, or raw HTTP can use `Authorization: Bearer <OPENAI_ADMIN_KEY>`

**What it gives**
- spend by time bucket
- aggregated usage by API key, project, user, model, line item, and more

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

**Useful field**
- `data.total_credits`

**Implementation guidance**
- prefer `/api/v1/key` for a richer meter
- use `/api/v1/credits` if you only need remaining credit balance

---

## OpenCode

### What is documented

OpenCode’s docs clearly document:
- how users connect providers
- where auth is stored
- that usage for OpenCode Go can be tracked in the console
- the published Go subscription limits

**Auth storage**
- `~/.local/share/opencode/auth.json`

**Console**
- `https://opencode.ai/auth`

**OpenCode Go documented limits**
- 5 hour limit: `$12` of usage
- weekly limit: `$30` of usage
- monthly limit: `$60` of usage

**Documented model endpoints**
- `https://opencode.ai/zen/go/v1/chat/completions`
- `https://opencode.ai/zen/go/v1/messages`
- model list: `https://opencode.ai/zen/go/v1/models`

### What is *not* clearly documented

At the time of this bootstrap, a stable public usage API for OpenCode Go / Zen was **not clearly documented**.

So the current safe position is:
- the subscription limits are documented
- the user can track usage in the OpenCode console
- a stable programmatic usage endpoint should be treated as unknown until confirmed in docs or code

### Practical implication for this repo

If we add OpenCode support early, it should likely start as one of:
- a documented “limits only” provider
- a console-link / informational provider
- or a provider backed by a later confirmed API once validated

Do **not** promise a stable OpenCode usage API until it is verified.

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
2. **GitHub Copilot org/enterprise billing** — official if the user has the right token/permissions.
3. **OpenAI admin usage/costs** — official for org dashboards.
4. **Anthropic admin usage** — official for org dashboards.
5. **Anthropic user subscription** — valuable, but unofficial.
6. **OpenAI/ChatGPT/Codex user subscription** — valuable, but unofficial.
7. **GitHub Copilot personal counters** — valuable, but unofficial.
8. **OpenCode** — wait for a clearly documented usage API or ship as informational-only first.

---

## Summary for future coding work

If the product goal is **stable, documented, low-risk integrations**, start with OpenRouter and official org/admin APIs.

If the product goal is **personal subscription meters like Claude Pro/Max, ChatGPT Plus/Pro, Codex, or personal Copilot quota counters**, expect private or reverse-engineered endpoints and build those behind explicit labels and careful error handling.
