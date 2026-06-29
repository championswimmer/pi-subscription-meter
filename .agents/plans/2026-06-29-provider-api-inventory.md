# Provider quota / subscription API inventory

- **Status:** completed research
- **Date:** 2026-06-29
- **Owner:** agent
- **Primary inputs:** `pi-quotas` code inspection, official provider docs, targeted web research

## Scope

This inventory covers the providers currently present in `src/extensions/core/providers/`:
- `anthropic`
- `openai-codex`
- `openrouter`
- `opencode`
- `github-copilot`

It distinguishes between:
- **Official** APIs
- **Official but admin / org-scoped** APIs
- **Unofficial / internal / reverse-engineered** APIs
- **No stable public usage API found**

## Common local auth sources observed in `pi-quotas`

These are the auth locations and token shapes already used by adjacent Pi tooling:

- `~/.pi/agent/auth.json`
  - `anthropic` → OAuth bearer token for Claude product APIs
  - `openai-codex` → OAuth token for ChatGPT/Codex product APIs
  - `github-copilot` → OAuth credential; Pi tooling may use `refresh` as GitHub OAuth token and `access` for Copilot proxy token
  - `openrouter` → API key
- `~/.codex/auth.json`
  - used as fallback to read `tokens.account_id` / `tokens.accountId` for ChatGPT/Codex requests
- `gh auth token`
  - used by `pi-quotas` as a fallback for GitHub Copilot internal quota requests
- `~/.local/share/opencode/auth.json`
  - documented OpenCode auth storage, but no stable usage API was found

## Recommended implementation priority

1. **OpenRouter** — best official quota-style API for end users.
2. **OpenAI official org usage/costs** — official, but admin-scoped and not personal ChatGPT subscription usage.
3. **Anthropic official org usage/costs** — official, but admin-scoped and not personal Claude Pro/Max usage.
4. **GitHub Copilot org/enterprise billing + metrics** — official, but org/enterprise scoped.
5. **Anthropic personal usage** — useful, but unofficial.
6. **OpenAI Codex / ChatGPT personal usage** — useful, but unofficial and schema appears volatile.
7. **GitHub Copilot personal usage** — useful, but unofficial/internal.
8. **OpenCode** — no stable documented usage endpoint; informational-only unless new evidence appears.

## Summary matrix

| Provider | Endpoint(s) to prefer | Stability | Access model | Best fit |
| --- | --- | --- | --- | --- |
| Anthropic | `GET https://api.anthropic.com/v1/organizations/usage_report/messages` | Official admin API | Anthropic Admin API key | Org/workspace usage analytics |
| Anthropic | `GET https://api.anthropic.com/v1/organizations/cost_report` | Official admin API | Anthropic Admin API key | Org/workspace cost analytics |
| Anthropic | `GET https://api.anthropic.com/api/oauth/usage` | Unofficial product API | OAuth bearer token | Personal Claude subscription-style windows |
| OpenAI | `GET https://api.openai.com/v1/organization/usage/completions` | Official admin API | OpenAI Admin API key | Org completions usage |
| OpenAI | `GET https://api.openai.com/v1/organization/costs` | Official admin API | OpenAI Admin API key | Org cost reporting |
| OpenAI / ChatGPT / Codex | `GET https://chatgpt.com/backend-api/wham/usage` | Unofficial internal API | ChatGPT/Codex bearer token + account id | Personal Codex / ChatGPT subscription windows |
| OpenRouter | `GET https://openrouter.ai/api/v1/key` | Official | OpenRouter API key | Budget, usage, daily/weekly/monthly tracking |
| OpenRouter | `GET https://openrouter.ai/api/v1/credits` | Official | OpenRouter management key | Total credits purchased / total usage |
| GitHub Copilot | `GET https://api.github.com/orgs/{org}/copilot/billing` and related seat endpoints | Official | GitHub PAT / app token with org billing permissions | Org seat/billing state |
| GitHub Copilot | `GET https://api.github.com/orgs/{org}/copilot/metrics/reports/...` and enterprise equivalents | Official | GitHub token with org/enterprise metrics permissions | Org/enterprise daily or 28-day usage reports |
| GitHub Copilot | `GET https://api.github.com/copilot_internal/v2/token`, `GET https://api.github.com/copilot_internal/user` | Unofficial internal API | GitHub OAuth token / exchanged Copilot token | Personal monthly counters |
| OpenCode | none found | No stable public usage API found | Console / API key | Limits only, console-link, or future API |

---

## Anthropic

### A1. Official org usage report

**Status**
- Official admin API

**Endpoint**
- `GET https://api.anthropic.com/v1/organizations/usage_report/messages`

**Auth / headers**
- `x-api-key: <ANTHROPIC_ADMIN_KEY>`
- `anthropic-version: 2023-06-01`
- optional beta headers for specific preview dimensions, e.g. speed tracking

**Request schema**
- Method: `GET`
- Query params observed in docs:
  - time range params (`start_time` / `end_time` semantics in docs)
  - time bucket granularity / bucket width (`1m`, `1h`, `1d` in docs overview)
  - `group_by`
  - pagination params (`page`, `limit` / `next_page` flow)
  - filters by API key, workspace, model, service tier, context window, inference geography, and speed/beta dimensions
- Body: none

**Response schema**
- Top-level: paginated report object
  - `data`: array of bucket rows or grouped usage rows
  - `has_more`: boolean
  - `next_page`: string cursor when more data exists
- Usage rows documented / observed to include usage-oriented fields such as:
  - time bucket start/end
  - token metrics / core metrics
  - model breakdown or grouped dimensions
  - estimated cost fields
  - actor / API key / workspace / model / service tier dimensions when grouped
- Practical implementation assumption:
  - treat the response as bucketed org analytics data, not personal subscription data

**What Pi can derive from it**
- org token usage over time
- model/workspace/API-key breakdowns
- cost-adjacent usage dashboards

**Caveats**
- not usable for normal end-user Claude Pro/Max-style “5h left” counters
- requires admin-level access

### A2. Official org cost report

**Status**
- Official admin API

**Endpoint**
- `GET https://api.anthropic.com/v1/organizations/cost_report`

**Auth / headers**
- same as A1

**Request schema**
- Method: `GET`
- Query params documented at a high level:
  - time range
  - daily granularity / bucketing
  - grouping fields such as workspace or description
  - pagination via `has_more` / `next_page`
- Body: none

**Response schema**
- Top-level paginated report object
  - `data`
  - `has_more`
  - `next_page`
- Cost rows are documented to include:
  - cost amount in USD / lowest units
  - time bucket boundaries
  - grouping dimensions such as workspace / description
  - service-level cost breakdowns

**What Pi can derive from it**
- org cost-over-time displays
- workspace chargeback summaries

**Caveats**
- exact field names were harder to scrape than usage-report fields because of the dynamic docs UI; treat the live Anthropic docs as the final authority during implementation

### A3. Unofficial personal subscription usage

**Evidence source**
- `pi-quotas/src/providers/fetch.ts`
- `pi-quotas/src/providers/providers.ts`

**Status**
- Unofficial / product-specific API

**Endpoint**
- `GET https://api.anthropic.com/api/oauth/usage`

**Auth / headers**
- `Authorization: Bearer <oauth-access-token>`
- `anthropic-beta: oauth-2025-04-20`
- `Accept: application/json`

**Request schema**
- Method: `GET`
- Query params: none observed
- Body: none

**Observed response schema**
```json
{
  "five_hour": {
    "utilization": 37,
    "resets_at": "2026-06-29T12:34:56Z"
  },
  "seven_day": {
    "utilization": 18,
    "resets_at": "2026-07-01T00:00:00Z"
  },
  "seven_day_sonnet": {
    "utilization": 21,
    "resets_at": "2026-07-01T00:00:00Z"
  },
  "seven_day_omelette": {
    "utilization": 5,
    "resets_at": "2026-07-01T00:00:00Z"
  },
  "seven_day_opus": {
    "utilization": 0,
    "resets_at": "2026-07-01T00:00:00Z"
  },
  "extra_usage": {
    "is_enabled": true,
    "monthly_limit": 5000,
    "used_credits": 1200,
    "currency": "USD",
    "utilization": 24
  }
}
```

**Fields actually consumed by `pi-quotas`**
- `five_hour.utilization`
- `five_hour.resets_at`
- `seven_day.utilization`
- `seven_day.resets_at`
- optional per-model weekly windows
- `extra_usage.is_enabled`
- `extra_usage.monthly_limit`
- `extra_usage.used_credits`
- `extra_usage.currency`
- `extra_usage.utilization`

**What Pi can derive from it**
- 5h and 7d percentage meters
- per-model weekly windows
- monthly overage/extra-budget meter

**Caveats**
- private product API; likely to change without notice
- this is the closest thing to a Claude Pro/Max-style personal meter

---

## OpenAI / ChatGPT / Codex

### O1. Official org completions usage

**Status**
- Official admin API

**Endpoint**
- `GET https://api.openai.com/v1/organization/usage/completions`

**Auth / headers**
- `Authorization: Bearer <OPENAI_ADMIN_KEY>`
- optionally `OpenAI-Organization: <org_id>`
- optionally `OpenAI-Project: <project_id>` when needed

**Request schema**
- Method: `GET`
- Query params captured from docs:
  - `start_time` — required Unix timestamp in seconds, inclusive
  - `end_time` — optional Unix timestamp in seconds
  - `bucket_width` — time bucket width
  - `group_by` — one or more grouping dimensions
  - `limit` — page/bucket limit
  - `page` — pagination cursor
- Body: none

**Response schema**
```json
{
  "data": [
    {
      "start_time": 1719628800,
      "end_time": 1719715200,
      "object": "bucket",
      "results": [
        {
          "object": "organization.usage.completions.result",
          "input_tokens": 123456,
          "output_tokens": 45678,
          "num_model_requests": 789,
          "input_cached_tokens": 12000,
          "input_audio_tokens": 0,
          "output_audio_tokens": 0,
          "api_key_id": "key_...",
          "model": "gpt-4.1",
          "project_id": "proj_...",
          "service_tier": "default",
          "user_id": "user_...",
          "batch": false
        }
      ]
    }
  ],
  "has_more": false,
  "next_page": null,
  "object": "page"
}
```

**Fields actually useful for Pi**
- `input_tokens`
- `output_tokens`
- `input_cached_tokens`
- `num_model_requests`
- grouped dimensions: `api_key_id`, `model`, `project_id`, `service_tier`, `user_id`, `batch`
- bucket boundaries: `start_time`, `end_time`

**What Pi can derive from it**
- org-level completions usage charts
- model or project cost-proxy dashboards

**Caveats**
- not a ChatGPT Plus/Pro or Codex end-user subscription meter
- requires admin-level key access

### O2. Official org costs

**Status**
- Official admin API

**Endpoint**
- `GET https://api.openai.com/v1/organization/costs`

**Auth / headers**
- same as O1

**Request schema**
- Method: `GET`
- Query params follow the same pattern as O1:
  - `start_time`
  - `end_time`
  - `bucket_width`
  - `group_by`
  - `limit`
  - `page`
- Body: none

**Response schema**
```json
{
  "data": [
    {
      "start_time": 1719628800,
      "end_time": 1719715200,
      "object": "bucket",
      "results": [
        {
          "object": "organization.costs.result",
          "amount": {
            "currency": "usd",
            "value": 12.34
          },
          "api_key_id": "key_...",
          "line_item": "responses",
          "project_id": "proj_...",
          "quantity": 123456
        }
      ]
    }
  ],
  "has_more": false,
  "next_page": null,
  "object": "page"
}
```

**Fields actually useful for Pi**
- `amount.currency`
- `amount.value`
- `line_item`
- `api_key_id`
- `project_id`
- `quantity`
- `start_time`, `end_time`

**What Pi can derive from it**
- org spend over time
- grouped cost breakdowns by project, key, or line item

### O3. Unofficial personal ChatGPT / Codex usage

**Evidence sources**
- `pi-quotas/src/providers/fetch.ts`
- `pi-quotas/src/providers/providers.ts`
- adjacent `pi-usage` package docs

**Status**
- Unofficial / reverse-engineered internal API

**Endpoint**
- `GET https://chatgpt.com/backend-api/wham/usage`

**Auth / headers**
- `Authorization: Bearer <chatgpt-or-codex-access-token>`
- `ChatGPT-Account-Id: <account-id>`
- `Accept: application/json`
- `Origin: https://chatgpt.com`
- `Referer: https://chatgpt.com/`
- browser-like `User-Agent`

**Extra metadata required**
- account id, typically from:
  - `~/.pi/agent/auth.json` → `openai-codex.accountId`
  - fallback `~/.codex/auth.json` → `tokens.account_id` / `tokens.accountId`

**Observed response schema shape consumed by `pi-quotas`**
```json
{
  "rate_limit": {
    "primary_window": {
      "percent_left": 68,
      "reset_at": "2026-06-29T12:34:56Z",
      "limit_window_seconds": 18000
    },
    "secondary_window": {
      "percent_left": 85,
      "reset_at": "2026-07-01T00:00:00Z",
      "limit_window_seconds": 604800
    }
  },
  "credits": {
    "has_credits": true,
    "balance": 18.5,
    "approx_local_messages": 42
  },
  "spend_control": {
    "reached": false
  }
}
```

**Alternate observed response shape from adjacent tooling**
```json
{
  "code": 200,
  "data": {
    "limits": [
      {
        "type": "TOKENS_LIMIT",
        "unit": 3,
        "percentage": 16,
        "nextResetTime": 1777819631597
      },
      {
        "type": "TOKENS_LIMIT",
        "unit": 6,
        "percentage": 4,
        "nextResetTime": 1778262784969
      },
      {
        "type": "TIME_LIMIT",
        "unit": 5,
        "percentage": 0,
        "nextResetTime": 1780336384978
      }
    ],
    "level": "lite"
  }
}
```

**Fields actually consumed by `pi-quotas`**
- `rate_limit` or `rate_limits`
- primary 5h window:
  - `primary_window` / `primary` / `five_hour_limit` / `five_hour`
  - `%` via `percent_left`, `remaining_percent`, or `used_percent`
  - reset via `reset_at` or `reset_time_ms`
  - optional `limit_window_seconds`
- secondary weekly window:
  - `secondary_window` / `secondary` / `weekly_limit` / `weekly`
- `credits.has_credits`
- `credits.balance`
- `credits.approx_local_messages`
- `spend_control.reached`

**What Pi can derive from it**
- 5h and weekly personal usage windows
- credit balance
- spend-cap state

**Caveats**
- schema is clearly volatile; at least two different shapes were observed in adjacent tooling
- use only behind explicit “unofficial” labeling

---

## OpenRouter

### R1. Current key metadata / budget / usage

**Status**
- Official

**Endpoint**
- `GET https://openrouter.ai/api/v1/key`

**Auth / headers**
- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `Accept: application/json`

**Request schema**
- Method: `GET`
- Query params: none
- Body: none

**Response schema**
```json
{
  "data": {
    "byok_usage": 17.38,
    "byok_usage_daily": 17.38,
    "byok_usage_monthly": 17.38,
    "byok_usage_weekly": 17.38,
    "creator_user_id": "user_...",
    "include_byok_in_limit": false,
    "is_free_tier": false,
    "is_management_key": false,
    "label": "sk-or-v1-...",
    "limit": 100,
    "limit_remaining": 74.5,
    "limit_reset": "monthly",
    "usage": 25.5,
    "usage_daily": 25.5,
    "usage_monthly": 25.5,
    "usage_weekly": 25.5,
    "is_provisioning_key": false,
    "rate_limit": {
      "interval": "1h",
      "note": "This field is deprecated and safe to ignore.",
      "requests": 1000
    },
    "expires_at": "2027-12-31T23:59:59Z"
  }
}
```

**Fields actually useful for Pi**
- `limit`
- `limit_remaining`
- `usage_daily`
- `usage_weekly`
- `usage_monthly`
- `limit_reset`
- `is_free_tier`
- `expires_at`

**What Pi can derive from it**
- monthly budget meter
- remaining credits / spend budget
- daily/weekly/monthly tracking windows

### R2. Credits summary

**Status**
- Official

**Endpoint**
- `GET https://openrouter.ai/api/v1/credits`

**Auth / headers**
- `Authorization: Bearer <OPENROUTER_MANAGEMENT_KEY>`

**Request schema**
- Method: `GET`
- Query params: none
- Body: none

**Response schema**
```json
{
  "data": {
    "total_credits": 100.5,
    "total_usage": 25.75
  }
}
```

**What Pi can derive from it**
- purchased credits
- cumulative used credits

**Caveats**
- `pi-quotas` uses `/api/v1/key` because it is richer and more practical for live quota meters

---

## GitHub Copilot

### G1. Official org billing summary

**Status**
- Official

**Endpoint**
- `GET https://api.github.com/orgs/{org}/copilot/billing`

**Auth / headers**
- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10`

**Request schema**
- Method: `GET`
- Path params:
  - `org`
- Query params: none observed
- Body: none

**Response schema**
- GitHub docs confirm a billing summary object for the org.
- In this scrape, the exact example body was less directly captured than the seat-list response.
- Expect this endpoint to provide org-level Copilot billing state, while the seats endpoint provides the detailed assignable inventory.

**Implementation note**
- use this alongside G2 rather than as a sole source of detail

### G2. Official org seat inventory

**Status**
- Official

**Endpoint**
- `GET https://api.github.com/orgs/{org}/copilot/billing/seats`

**Auth / headers**
- same as G1

**Request schema**
- Method: `GET`
- Path params:
  - `org`
- Query params: none observed
- Body: none

**Response schema**
```json
{
  "total_seats": 2,
  "seats": [
    {
      "created_at": "2021-08-03T18:00:00-06:00",
      "updated_at": "2021-09-23T15:00:00-06:00",
      "pending_cancellation_date": null,
      "last_activity_at": "2021-10-14T00:53:32-06:00",
      "last_activity_editor": "vscode/1.77.3/copilot/1.86.82",
      "last_authenticated_at": "2021-10-14T00:53:32-06:00",
      "plan_type": "business",
      "assignee": {
        "login": "octocat",
        "id": 1,
        "node_id": "MDQ6VXNlcjE=",
        "avatar_url": "https://github.com/...",
        "url": "https://api.github.com/users/octocat",
        "html_url": "https://github.com/octocat",
        "type": "User",
        "site_admin": false
      },
      "assigning_team": {
        "id": 1,
        "node_id": "MDQ6VGVhbTE=",
        "url": "https://api.github.com/teams/1",
        "html_url": "https://github.com/orgs/github/teams/justice-league",
        "name": "Justice League",
        "slug": "justice-league",
        "description": "A great team.",
        "privacy": "closed",
        "notification_setting": "notifications_enabled",
        "permission": "admin",
        "members_url": "https://api.github.com/teams/1/members{/member}",
        "repositories_url": "https://api.github.com/teams/1/repos",
        "parent": null
      }
    }
  ]
}
```

**What Pi can derive from it**
- total seat count
- seat assignees
- plan type per seat
- last activity / last auth metadata
- cancellation state

### G3. Official org member assignment detail

**Status**
- Official

**Endpoint**
- `GET https://api.github.com/orgs/{org}/members/{username}/copilot`

**Auth / headers**
- same as G1

**Request schema**
- Method: `GET`
- Path params:
  - `org`
  - `username`
- Body: none

**Response schema**
- `assignee`: GitHub user object or `null`
- `organization`: org object or `null`
- `assigning_team`: team object
- `pending_cancellation_date`: string or `null`
- `last_activity_at`: string or `null`
- `last_activity_editor`: string or `null`
- `last_authenticated_at`: string or `null`
- `created_at`: string
- `updated_at`: string
- `plan_type`: string

**What Pi can derive from it**
- single-user assignment status inside an org
- useful for “am I assigned?” org-level checks

### G4. Official enterprise seat inventory / assignment detail

**Status**
- Official

**Endpoints**
- `GET https://api.github.com/enterprises/{enterprise}/copilot/billing/seats`
- `GET https://api.github.com/enterprises/{enterprise}/members/{username}/copilot`

**Auth / headers**
- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10`
- permissions generally require enterprise owner / billing-manager or equivalent app permissions

**Request schema**
- Method: `GET`
- Path params:
  - `enterprise`
  - optional `username` for member detail
- Body: none

**Response schema**
- analogous to the org seat / assignment endpoints above

### G5. Official org/enterprise usage metrics report endpoints

**Status**
- Official

**Endpoints observed**
- Organization:
  - `GET https://api.github.com/orgs/{org}/copilot/metrics/reports/organization-1-day?day=YYYY-MM-DD`
  - `GET https://api.github.com/orgs/{org}/copilot/metrics/reports/organization-28-day/latest`
  - `GET https://api.github.com/orgs/{org}/copilot/metrics/reports/user-teams-1-day?day=YYYY-MM-DD`
  - `GET https://api.github.com/orgs/{org}/copilot/metrics/reports/users-1-day?day=YYYY-MM-DD`
- Enterprise:
  - `GET https://api.github.com/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day?day=YYYY-MM-DD`
  - `GET https://api.github.com/enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest`
  - `GET https://api.github.com/enterprises/{enterprise}/copilot/metrics/reports/user-teams-1-day?day=YYYY-MM-DD`
  - `GET https://api.github.com/enterprises/{enterprise}/copilot/metrics/reports/users-1-day?day=YYYY-MM-DD`
  - `GET https://api.github.com/enterprises/{enterprise}/copilot/metrics/reports/users-28-day/latest`

**Auth / headers**
- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10`
- org metrics: org owner or token with org Copilot metrics read permission / `read:org`
- enterprise metrics: enterprise owner / billing manager / fine-grained enterprise Copilot metrics read permission, or classic scopes like `manage_billing:copilot` / `read:enterprise`

**Request schema**
- Method: `GET`
- Path params:
  - `org` or `enterprise`
- Query params:
  - `day` required for `*-1-day` endpoints, `YYYY-MM-DD`
- Body: none

**Response schema**
- daily report endpoints:
```json
{
  "download_links": [
    "https://example.com/copilot-usage-report-1.ndjson",
    "https://example.com/copilot-usage-report-2.ndjson"
  ],
  "report_day": "2025-07-01"
}
```
- latest 28-day endpoints:
```json
{
  "download_links": [
    "https://example.com/copilot-usage-report-1.ndjson",
    "https://example.com/copilot-usage-report-2.ndjson"
  ],
  "report_start_day": "2025-07-01",
  "report_end_day": "2025-07-28"
}
```

**What Pi can derive from it**
- downloadable org/enterprise usage reports
- analytics pipeline inputs
- not ideal for instantaneous personal “remaining this month” counters

### G6. Unofficial personal monthly counters

**Evidence source**
- `pi-quotas/src/providers/fetch.ts`
- `pi-quotas/src/providers/providers.ts`

**Status**
- Unofficial / internal API

**Endpoints**
- `GET https://api.github.com/copilot_internal/v2/token`
- `GET https://api.github.com/copilot_internal/user`

**Auth / headers**
- exchanged or direct bearer/token auth
- `pi-quotas` sends editor identity headers:
  - `Accept: application/json`
  - `Authorization: Bearer ...` or `Authorization: token ...`
  - `User-Agent: GitHubCopilotChat/0.35.0`
  - `Editor-Version: vscode/1.107.0`
  - `Editor-Plugin-Version: copilot-chat/0.35.0`
  - `Copilot-Integration-Id: vscode-chat`
  - `Content-Type: application/json`

**Observed auth flow in `pi-quotas`**
1. try GitHub OAuth token from Pi auth storage
2. call `/copilot_internal/v2/token`
3. if response contains `token`, call `/copilot_internal/user` with that token
4. if that fails, try the stored token directly against `/copilot_internal/user`
5. if that fails, try `gh auth token`

**Observed response schema consumed by `pi-quotas`**
```json
{
  "quota_reset_date": "2026-07-01T00:00:00Z",
  "quota_snapshots": {
    "premium_interactions": {
      "entitlement": 300,
      "remaining": 120,
      "overage_count": 0,
      "overage_permitted": false,
      "unlimited": false
    },
    "chat": {
      "entitlement": 1000,
      "remaining": 850,
      "overage_count": 0,
      "overage_permitted": false,
      "unlimited": false
    },
    "completions": {
      "entitlement": 2000,
      "remaining": 1800,
      "overage_count": 0,
      "overage_permitted": true,
      "unlimited": false
    }
  }
}
```

**Older/fallback observed response shape**
```json
{
  "limited_user_reset_date": "2026-07-01T00:00:00Z",
  "monthly_quotas": {
    "chat": 1000,
    "completions": 2000
  },
  "limited_user_quotas": {
    "chat": 850,
    "completions": 1800
  }
}
```

**Fields actually useful for Pi**
- reset date via `quota_reset_date`, `quota_reset_date_utc`, or `limited_user_reset_date`
- `quota_snapshots.premium_interactions.entitlement`
- `quota_snapshots.premium_interactions.remaining`
- `quota_snapshots.chat.entitlement`
- `quota_snapshots.chat.remaining`
- `quota_snapshots.completions.entitlement`
- `quota_snapshots.completions.remaining`
- `overage_count`, `overage_permitted`, `unlimited`

**What Pi can derive from it**
- monthly personal counters for premium interactions / chat / completions
- overage hints

**Caveats**
- internal API; likely to break more easily than the official org endpoints

---

## OpenCode

### C1. Documented limits, but no stable public usage API

**Status**
- No stable public usage API found

**Documented endpoints**
- inference only, not billing/usage:
  - `POST https://opencode.ai/zen/go/v1/chat/completions`
  - `POST https://opencode.ai/zen/go/v1/messages`
  - `GET https://opencode.ai/zen/go/v1/models`

**Documented auth / console facts**
- users subscribe in the OpenCode Zen console
- usage can be tracked in the console
- documented auth storage: `~/.local/share/opencode/auth.json`
- console URL: `https://opencode.ai/auth`

**Documented Go limits**
- 5 hour limit: `$12` of usage
- weekly limit: `$30` of usage
- monthly limit: `$60` of usage

**Programmatic request/response schema**
- none documented for usage/billing/quota

**Practical implementation note**
- current safe implementation is informational only:
  - show documented limits
  - link to console
  - do not promise live quota fetching until a real API is validated

---

## Implementation guidance for the next phase

### Safest providers to implement first

1. **OpenRouter**
   - single official endpoint
   - end-user friendly
   - rich enough to render useful windows immediately

2. **OpenAI org usage/costs**
   - official and strongly typed
   - good for org dashboards
   - not a personal subscription meter

3. **Anthropic org usage/costs**
   - official and admin-focused
   - good for org dashboards
   - not a personal subscription meter

4. **GitHub Copilot org/enterprise endpoints**
   - official, but enterprise/admin-oriented
   - useful for seat state and downloadable metrics, not live personal remainder meters

### Useful but risky personal-meter integrations

- Anthropic `api/oauth/usage`
- ChatGPT/Codex `backend-api/wham/usage`
- GitHub `copilot_internal/*`

These should be:
- labeled **Unofficial** in UI and docs
- wrapped in defensive parsing
- isolated so a schema change does not break the rest of `/subscriptions`

### Suggested fetcher normalization targets

For implementation, normalize provider responses into a common internal shape such as:
- `windows[]`
  - `label`
  - `usedPercent`
  - `usedValue`
  - `limitValue`
  - `resetsAt`
  - `windowSeconds`
  - `isCurrency`
  - `metadata`

This matches what `pi-quotas` already does and is a good fit for the Pi TUI.

## Final recommendation

If the goal is a **stable first implementation**, ship:
- OpenRouter
- OpenAI official org usage/costs
- Anthropic official org usage/costs
- GitHub Copilot official org/enterprise endpoints

If the goal is a **personal subscription meter**, add the unofficial provider-specific endpoints only behind explicit labels and careful error handling.