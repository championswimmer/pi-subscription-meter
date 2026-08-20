# pi-subscription-meter

A Pi extension package for surfacing subscription, quota, and usage limits across AI providers.

<img width="973" height="704" alt="image" src="https://github.com/user-attachments/assets/e54f71ac-fa59-438a-9936-61201deec457" />

## Check out my other Pi extensions

- [![pi-auto-theme](https://img.shields.io/badge/🎨_pi--auto--theme-blue?style=flat-square)](https://github.com/championswimmer/pi-auto-theme) — Auto-syncs Pi theme with OS dark/light mode.
- [![pi-cache-graph](https://img.shields.io/badge/📊_pi--cache--graph-orange?style=flat-square)](https://github.com/championswimmer/pi-cache-graph) — Real-time prompt cache hit rates and token metrics.
- [![pi-context-prune](https://img.shields.io/badge/✂️_pi--context--prune-green?style=flat-square)](https://github.com/championswimmer/pi-context-prune) — Prunes verbose tool outputs from context while preserving history.
- [![pi-context-usage](https://img.shields.io/badge/🪟_pi--context--usage-purple?style=flat-square)](https://github.com/championswimmer/pi-context-usage) — Dot-grid visualization of context window token usage.
- [![pi-speedometer](https://img.shields.io/badge/⚡_pi--speedometer-yellow?style=flat-square)](https://github.com/championswimmer/pi-speedometer) — Live tokens/sec and TTFT in the status bar.
- [![pi-subscription-meter](https://img.shields.io/badge/💳_pi--subscription--meter-red?style=flat-square)](https://github.com/championswimmer/pi-subscription-meter) — Tracks subscription quotas and rate limits across AI providers.

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

Press `s` inside the dialog to open provider settings in a sub-dialog overlay and enable/disable providers.

## Enabled providers

Enabled providers are determined by saved extension settings.

The extension stores its settings in the Pi agent directory using the documented Pi helper for resolving that path (`getAgentDir()`), and writes:

```text
~/.pi/agent/subscription-meter.json
```

If `PI_CODING_AGENT_DIR` is set, Pi’s configured agent directory override is respected automatically.

Use the in-app settings overlay opened with `s` from `/subscriptions` to update provider enablement.

## Planned package shape

- `src/extensions/core/index.ts` — Pi extension entrypoint
- `.agents/skills/` — reusable Agent Skills for planning and provider research
- `.agents/plans/` — implementation plans created before work begins
