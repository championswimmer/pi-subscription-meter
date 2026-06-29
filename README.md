# pi-subscription-meter

A Pi extension package for surfacing subscription, quota, and usage limits across AI providers.

## Status

Bootstrap/scaffolding only.

This repository currently contains:
- npm + TypeScript package setup for a Pi extension
- a placeholder extension entrypoint
- repo-level agent instructions in `AGENTS.md`
- Agent Skills under `.agents/skills/`
- an initial planning workflow under `.agents/plans/`

Implementation of the actual subscription meter UI and provider integrations will come next.

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

## Planned package shape

- `src/extensions/core/index.ts` — Pi extension entrypoint
- `.agents/skills/` — reusable Agent Skills for planning and provider research
- `.agents/plans/` — implementation plans created before work begins
