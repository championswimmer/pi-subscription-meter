# Subscriptions settings persistence and dialog

- **Status:** in-progress
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Replace the temporary environment-variable based provider enablement with saved settings stored in the Pi agent directory, and add a settings sub-dialog opened with `s` from the `/subscriptions` TUI dialog so providers can be enabled or disabled interactively.

## Checklist

- [ ] Review Pi docs for accessing the agent directory and for relevant TUI/dialog patterns.
- [ ] Design a persisted settings format for enabled/disabled providers in `subscription-meter.json` under the Pi agent directory.
- [ ] Implement settings load/save helpers and remove the environment-variable override behavior.
- [ ] Update the provider registry to derive enabled providers from persisted settings with sensible defaults.
- [ ] Add a settings sub-dialog that opens on `s` from the main subscriptions dialog.
- [ ] Allow toggling provider enabled state from the settings dialog and persist changes immediately or on close.
- [ ] Refresh the main tabs after settings changes so the visible tab count matches enabled providers.
- [ ] Update docs and plan files to reflect the new settings-based behavior.
- [ ] Validate with `npm run typecheck`.

## Detailed implementation plan

1. Read the Pi docs and installed package examples to find the supported way to resolve the Pi agent directory or other stable storage location for extension data.
2. Define a small JSON settings schema that records enabled provider ids, plus format/version metadata if useful.
3. Implement a storage module that resolves the settings path, reads existing JSON safely, validates provider ids, falls back to defaults, and writes updates atomically enough for this extension.
4. Refactor the provider registry so it no longer accepts an env override path as the primary mechanism. It should instead accept loaded settings and expose methods that are convenient for the UI.
5. Extend the subscriptions TUI so pressing `s` opens a nested settings overlay. The settings overlay should list all providers, show enabled/disabled state, and allow toggling while keeping the main dialog beneath it.
6. On save/close of the settings dialog, persist the updated provider selection, update the registry in memory, and re-render the main subscriptions dialog so the set of tabs exactly matches enabled providers.
7. Update README and planning artifacts so the behavior is documented, then run typecheck and inspect the resulting file layout.

## Risks / questions

- Pi may not expose a first-class extension data directory API, so we may need to derive the agent directory from documented paths.
- A nested dialog may need to be implemented inside one custom renderer rather than literally stacking two separate `ctx.ui.custom()` calls.
- We should avoid corrupting user settings if a write fails or if the JSON becomes invalid.

## Validation

- `npm run typecheck`
- verify environment-variable-based provider selection has been removed
- verify settings path resolves under the Pi agent directory and writes `subscription-meter.json`
- verify pressing `s` opens the settings overlay and toggling providers changes the visible tabs after closing it
