---
name: api-subscription-research
description: Identify which APIs, endpoints, local auth stores, and token flows can be used to read subscription, billing, quota, and usage information for providers like Anthropic, OpenAI, OpenRouter, OpenCode, and GitHub Copilot. Use when planning or implementing usage meters, quota dashboards, billing summaries, or auth-backed provider integrations.
compatibility: Useful for Pi extensions and coding agents that need provider usage data and must distinguish official APIs from private or reverse-engineered endpoints.
---

## Goal

Use this skill when the task involves finding or implementing provider usage, quota, billing, or subscription-limit integrations.

The main reference is `references/PROVIDERS.md`.

## What this skill should do

1. Start with the provider matrix in `references/PROVIDERS.md`.
2. Distinguish between:
   - officially documented APIs
   - preview/admin APIs
   - private or reverse-engineered user endpoints
   - console-only flows with no stable public usage API
3. Identify the auth model required for each source:
   - admin API keys
   - normal API keys
   - OAuth/user bearer tokens
   - locally stored tokens from other tools
4. Prefer the most stable documented source that matches the user’s access level.
5. If the only available path is private or unofficial, call that out explicitly before implementation.

## Output expectations

When summarizing a provider, include:
- whether a usable usage/quota source exists
- endpoint URL(s)
- required auth token type and headers
- whether the source is official or unofficial
- the likely reset window or unit being measured
- implementation caveats

## Implementation guidance for this repository

- Prefer official endpoints first for OpenRouter, OpenAI admin usage, Anthropic admin usage, and GitHub Copilot org/enterprise billing.
- For end-user subscription meters such as Claude Pro/Max, ChatGPT Plus/Pro/Codex, and personal Copilot quota counters, expect unofficial or internal endpoints.
- If using Pi extension auth, try existing user-connected credentials before asking users to paste tokens manually.
- Never log raw tokens or persist them outside the user’s existing auth store unless explicitly required.

## Keep this current

If new facts are discovered while implementing provider support, update `references/PROVIDERS.md` so future work starts from the latest known state.
