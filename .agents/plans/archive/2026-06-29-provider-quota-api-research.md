# Provider quota / subscription API research

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Research the available subscription, quota, billing, and usage APIs for the providers currently in scope for this repository by combining:
- evidence from the `pi-quotas` codebase,
- official provider documentation,
- and targeted web research for any internal or unofficial user-facing quota endpoints.

The deliverable should clearly document, for each provider, the usable endpoints plus request/response schemas, auth requirements, stability level, and caveats for implementation in this Pi extension.

## Checklist

- [x] Review the current provider inventory in this repository and confirm the in-scope providers.
- [x] Audit `pi-quotas` to identify which endpoints, token sources, and quota-parsing flows it already uses.
- [x] Separate official/documented APIs from private, internal, preview, or reverse-engineered endpoints.
- [x] Research each provider on the public web and in official docs to verify endpoint URLs, required headers, and auth models.
- [x] Capture request schemas for each useful endpoint, including method, path, query params, headers, and token type.
- [x] Capture response schemas for each useful endpoint, including the quota/usage fields this extension would rely on.
- [x] Identify local auth/token sources that may be relevant for Pi integration where user-scoped endpoints are required.
- [x] Update `.agents/skills/api-subscription-research/references/PROVIDERS.md` with corrected summary references and link to the detailed inventory.
- [x] Write a repo-facing research summary that can be used to implement provider fetchers later.

## Detailed implementation plan

1. Start from `.agents/skills/api-subscription-research/references/PROVIDERS.md` and the current provider files under `src/extensions/core/providers/` to lock the research scope to Anthropic, OpenAI/Codex/ChatGPT, OpenRouter, OpenCode, and GitHub Copilot.
2. Inspect the `pi-quotas` repository to extract the concrete endpoints it calls, how it authenticates to each provider, how it finds local tokens, and which response fields it maps into quota windows or usage counters.
3. For each provider, classify each discovered endpoint into one of four buckets: official documented API, preview/admin API, unofficial internal product API, or console-only/no stable programmatic API.
4. Verify each candidate endpoint against official provider docs or high-confidence public evidence. Where the endpoint is unofficial, explicitly record that status and avoid presenting it as stable.
5. For each usable endpoint, document the request contract in a normalized format:
   - HTTP method
   - full URL or path
   - required headers
   - auth token type
   - required query parameters or body shape
   - account/org/workspace identifiers required in addition to the token
6. For each usable endpoint, document the response contract in a normalized format:
   - top-level object shape
   - quota/usage/billing fields
   - reset window fields
   - pagination or bucketing fields if present
   - notable nullable/optional fields
7. Note provider-specific token sources relevant to implementation, such as Pi auth storage, admin API keys, OAuth bearer tokens, `gh auth token`, `~/.codex/auth.json`, or other local auth files, while keeping clear boundaries around what is official versus opportunistic.
8. Update `.agents/skills/api-subscription-research/references/PROVIDERS.md` so the skill remains the source of truth for future work.
9. Produce a summarized implementation-oriented document or plan notes describing which providers are safest to implement first, which ones require admin access, and which ones depend on fragile private endpoints.

## Risks / questions

- Some of the most user-relevant subscription counters (for Claude Pro/Max, ChatGPT Plus/Pro/Codex, and personal GitHub Copilot) may only be available through unofficial or reverse-engineered endpoints.
- Official provider usage APIs often target org/admin billing use cases and may not expose the same counters users see in consumer products.
- `pi-quotas` may rely on internal behavior or undocumented token flows that should be copied only with explicit labeling and caution.
- OpenCode may still lack a stable publicly documented usage endpoint, which could limit support to informational-only limits unless stronger evidence is found.
- Request/response schemas for unofficial endpoints may change without notice and may need to be captured from code observations rather than formal docs.

## Validation

- Confirm every provider has a documented entry covering endpoint, auth model, stability level, and key response fields.
- Confirm each endpoint is marked as official, preview/admin, unofficial, or unknown.
- Confirm `pi-quotas`-derived findings are cross-checked against docs or other public evidence where possible.
- Confirm `.agents/skills/api-subscription-research/references/PROVIDERS.md` is updated if new facts are learned.
- Confirm the final research output is detailed enough to implement provider fetchers without redoing baseline endpoint discovery.

## Deliverables

- Detailed inventory: `.agents/plans/2026-06-29-provider-api-inventory.md`
- Reference summary: `.agents/skills/api-subscription-research/references/PROVIDERS.md`

## Outcome summary

Research is complete for the current provider set. We now have:
- the official vs unofficial endpoint split for each provider,
- concrete auth/token-source expectations,
- request/response schema notes for the usable endpoints,
- and an implementation ordering recommendation.

The next phase should use the detailed inventory plan as the implementation source of truth.