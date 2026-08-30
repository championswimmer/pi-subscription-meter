# Meta Muse usage research

- **Status:** complete
- **Date:** 2026-08-30
- **Owner:** agent

## Objective

Verify whether this environment already has direct Meta AI / Muse API access enabled, determine whether Muse Spark models can be called with the configured key, and identify any official or observed API endpoints that expose usage, billing, quota, or request-count information for that key. Capture the findings in the provider research references.

## Checklist

- [x] Inspect local environment/config for Meta/Muse API-key presence and model availability signals.
- [x] Research official Meta AI / Muse API documentation for auth, models, billing, and usage endpoints.
- [x] Validate any candidate usage-related endpoints or headers safely without exposing secrets.
- [x] Update `.agents/skills/api-subscription-research/references/PROVIDERS.md` with confirmed Meta/Muse findings.
- [x] Mark this plan complete with actual findings and caveats.

## Detailed implementation plan

1. Check the current environment and local Pi model metadata for evidence that `MUSE_API_KEY` is configured and whether Muse Spark models are reachable directly via `api.meta.ai`.
2. Search official Meta AI developer docs and supporting sources for documented endpoints covering model listing, chat/completions, billing, usage, rate limits, and account dashboards.
3. Where safe, issue non-destructive requests against documented or likely endpoints using the configured key, recording only status codes, high-level response shapes, and non-secret headers.
4. Distinguish between per-request usage returned inline with inference responses versus any aggregate usage/billing/reporting endpoint.
5. Update the provider reference document with a new Meta / Muse section that clearly labels what is official, what is observed-only, and what is still unavailable.
6. Update this plan so its checklist and notes reflect what was actually learned and changed.

## Risks / questions

- Meta may expose only per-request token usage and rate-limit headers, with billing totals available only in the dashboard.
- Some endpoints may be undocumented or gated by account tier, so absence of evidence from a single key is not absolute proof.
- Avoid logging the raw `MUSE_API_KEY` or copying full sensitive responses if they contain account identifiers.
- Completed findings: the local environment does have `MUSE_API_KEY` set, direct Meta Model API calls succeed, and current docs/live probes did not reveal a documented aggregate spend or historical request-count endpoint.
- Follow-up finding: the `dev.meta.ai` dashboard appears to use a private GraphQL `LLMDCUsageQuery` route that likely returns team usage/cost data, but it depends on browser-session cookies and CSRF tokens rather than the public API key.

## Validation

- Used official Meta docs plus live read-only API checks.
- Confirmed `GET /v1/models` and minimal `POST /v1/chat/completions`, `POST /v1/responses`, and `POST /v1/messages` succeeded with the configured key.
- Confirmed inline `usage` objects and `x-ratelimit-*` headers are available on successful inference responses.
- Probed `GET /v1/usage`, `GET /v1/billing`, `GET /v1/organization/usage`, and `GET /v1/organization/costs`; all returned `404` during this research pass.
