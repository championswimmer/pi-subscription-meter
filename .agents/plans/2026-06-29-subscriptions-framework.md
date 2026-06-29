# Subscriptions command framework

- **Status:** in-progress
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Create the basic framework for a Pi extension command `/subscriptions` that opens a tabbed Pi TUI dialog. The dialog should render one tab per enabled provider, and providers should be defined through a pluggable provider registry with initial empty scaffolds for OpenAI Codex, GitHub Copilot, Anthropic, OpenRouter, and OpenCode.

## Checklist

- [ ] Review Pi extension and TUI APIs relevant to commands and custom dialogs.
- [ ] Design a provider contract and registry for pluggable subscription providers.
- [ ] Add scaffold provider definitions for `openai-codex`, `github-copilot`, `anthropic`, `openrouter`, and `opencode`.
- [ ] Implement a tabbed subscriptions dialog component that renders enabled providers only.
- [ ] Register a `/subscriptions` command that opens the dialog.
- [ ] Add minimal enable/disable behavior so the dialog tab count matches enabled providers.
- [ ] Validate with `npm run typecheck`.
- [ ] Update this plan to reflect the implemented framework.

## Detailed implementation plan

1. Read the relevant Pi docs and examples for extension command registration and custom TUI rendering, especially patterns for `ctx.ui.custom()` and keyboard-driven components.
2. Define a provider interface that separates provider metadata from future fetching logic, including id, label, enabled state, and placeholder rendering data.
3. Create a provider registry module containing the five initial scaffold providers and helper functions for listing all providers and only enabled providers.
4. Build a custom TUI component for a bordered/tabbed subscriptions dialog. The component should support left/right tab switching, escape to close, and should render placeholder content for each provider scaffold.
5. Register a `/subscriptions` command in the extension entrypoint. The command should guard for TUI usage, derive enabled providers from the registry, and open the dialog.
6. Add a simple initial enabled/disabled model in code so not all providers have to appear at all times, while keeping the system easy to extend.
7. Run typecheck, fix any issues, and then update the plan checklist and notes to match the completed framework.

## Risks / questions

- Pi TUI may not have a built-in tab widget, so a lightweight custom component may be needed.
- We should keep the provider contract minimal now so we do not lock in the wrong data model before usage fetching is implemented.
- Some providers will ultimately rely on unofficial endpoints, but this framework step should stay fetch-free and UI-focused.

## Validation

- `npm run typecheck`
- manually inspect created files for a clear provider registry and dialog separation
- verify `/subscriptions` command registration exists in the extension entrypoint
- verify the dialog logic uses only enabled providers for tab rendering
