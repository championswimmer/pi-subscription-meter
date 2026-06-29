# pi-subscription-meter

A Pi extension package for surfacing subscription, quota, and usage limits across AI providers.

## Status

Early framework in place.

This repository currently contains:
- npm + TypeScript package setup for a Pi extension
- a `/subscriptions` Pi command
- a tabbed Pi TUI dialog that renders one tab per enabled provider
- a pluggable provider registry with initial scaffolds for OpenAI Codex, GitHub Copilot, Anthropic, OpenRouter, and OpenCode
- repo-level agent instructions in `AGENTS.md`
- Agent Skills under `.agents/skills/`
- an implementation planning workflow under `.agents/plans/`

Actual subscription fetching, auth wiring, and live usage meters will come next.

## Initial scope

The extension is intended to track or summarize subscription/usage information for providers such as:
- Anthropic
- OpenAI / ChatGPT / Codex
- OpenRouter
- OpenCode
- GitHub Copilot

## Inspiration

This project is intentionally inspired by:
- `latentminds-ai/pi-quotas`
- <https://github.com/latentminds-ai/pi-quotas>

## Development

```bash
npm install
npm run typecheck
```

## Current command

Once this extension is loaded in Pi, use:

```text
/subscriptions
```

This opens a tabbed dialog showing all currently enabled provider scaffolds.

## Enabled providers

Enabled providers are currently determined by the registry defaults, with an optional environment override:

```bash
PI_SUBSCRIPTION_METER_PROVIDERS=openrouter,anthropic
```

After changing the env var, reload the extension/session so the provider tabs refresh.

## Planned package shape

- `src/extensions/core/index.ts` — Pi extension entrypoint
- `.agents/skills/` — reusable Agent Skills for planning and provider research
- `.agents/plans/` — implementation plans created before work begins
