# Subscriptions settings persistence and dialog

- **Status:** complete
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Replace the temporary environment-variable based provider enablement with saved settings stored in the Pi agent directory, and add a settings sub-dialog opened with `s` from the `/subscriptions` TUI dialog so providers can be enabled or disabled interactively.

## Checklist

- [x] Review Pi docs for accessing the agent directory and for relevant TUI/dialog patterns.
- [x] Design a persisted settings format for enabled/disabled providers in `subscription-meter.json` under the Pi agent directory.
- [x] Implement settings load/save helpers and remove the environment-variable override behavior.
- [x] Update the provider registry to derive enabled providers from persisted settings with sensible defaults.
- [x] Add a settings sub-dialog that opens on `s` from the main subscriptions dialog.
- [x] Allow toggling provider enabled state from the settings dialog and persist changes immediately or on close.
- [x] Refresh the main tabs after settings changes so the visible tab count matches enabled providers.
- [x] Update docs and plan files to reflect the new settings-based behavior.
- [x] Validate with `npm run typecheck`.

## Detailed implementation plan

1. Read the Pi docs and installed package examples to find the supported way to resolve the Pi agent directory or other stable storage location for extension data.
2. Define a small JSON settings schema that records enabled provider ids, plus format/version metadata if useful.
3. Implement a storage module that resolves the settings path, reads existing JSON safely, validates provider ids, falls back to defaults, and writes updates atomically enough for this extension.
4. Refactor the provider registry so it no longer accepts an env override path as the primary mechanism. It should instead accept loaded settings and expose methods that are convenient for the UI.
5. Extend the subscriptions TUI so pressing `s` opens a nested settings overlay. The settings overlay should list all providers, show enabled/disabled state, and allow toggling while keeping the main dialog beneath it.
6. On save/close of the settings dialog, persist the updated provider selection, update the registry in memory, and re-render the main subscriptions dialog so the set of tabs exactly matches enabled providers.
7. Update README and planning artifacts so the behavior is documented, then run typecheck and inspect the resulting file layout.

## Risks / questions

- Pi does expose a documented helper (`getAgentDir()`), so the implementation uses that rather than hard-coding `~/.pi/agent`.
- The settings UI is implemented as a true overlay dialog on top of the main subscriptions dialog using `ctx.ui.custom(..., { overlay: true })`.
- Settings writes use a temp-file-then-rename flow to reduce the chance of leaving a partially written JSON file behind.
- Provider enablement is now settings-driven; future work may still want project-local overrides, but environment-variable overrides have been intentionally removed.

## Validation

- `npm run typecheck`
- verify environment-variable-based provider selection has been removed
- verify settings path resolves under the Pi agent directory and writes `subscription-meter.json`
- verify pressing `s` opens the settings overlay and toggling providers updates the enabled provider tabs
- verify the implementation uses Pi’s documented `getAgentDir()` helper so `PI_CODING_AGENT_DIR` is respected
