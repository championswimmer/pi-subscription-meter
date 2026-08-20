# pi-subscription-meter

A Pi extension package for surfacing subscription, quota, and usage limits across AI providers.

<img width="973" height="704" alt="image" src="https://github.com/user-attachments/assets/e54f71ac-fa59-438a-9936-61201deec457" />

## Check out my other Pi extensions

- [![pi-auto-theme](https://img.shields.io/badge/🎨_pi--auto--theme-blue?style=flat-square)](https://github.com/championswimmer/pi-auto-theme) — Automatically syncs Pi's theme with your OS dark/light mode appearance in real-time.
- [![pi-cache-graph](https://img.shields.io/badge/📊_pi--cache--graph-orange?style=flat-square)](https://github.com/championswimmer/pi-cache-graph) — Visualizes LLM prompt cache hit rates and token statistics across turns in your TUI.
- [![pi-context-prune](https://img.shields.io/badge/✂️_pi--context--prune-green?style=flat-square)](https://github.com/championswimmer/pi-context-prune) — Automatically prunes verbose tool outputs from future LLM context while preserving full history.
- [![pi-context-usage](https://img.shields.io/badge/🪟_pi--context--usage-purple?style=flat-square)](https://github.com/championswimmer/pi-context-usage) — Visualizes context window token distribution (system prompt, tools, messages, buffer) in a dot-grid summary.
- [![pi-speedometer](https://img.shields.io/badge/⚡_pi--speedometer-yellow?style=flat-square)](https://github.com/championswimmer/pi-speedometer) — Displays live LLM generation speed (tokens/sec) and time-to-first-token (TTFT) in the status bar.
- [![pi-subscription-meter](https://img.shields.io/badge/💳_pi--subscription--meter-red?style=flat-square)](https://github.com/championswimmer/pi-subscription-meter) — Surfaces subscription tiers, rate limits, and quota consumption across AI providers in a tabbed dialog.

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
