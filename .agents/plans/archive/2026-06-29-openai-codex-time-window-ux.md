# OpenAI Codex time-window UX follow-up

- **Status:** completed
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Improve the OpenAI Codex provider so session and weekly windows show how much time is left until reset and render a notch in the progress bar indicating the current point in the time window.

## Checklist

- [x] Review the current Codex runtime loader and progress bar rendering path.
- [x] Add a window-level way to represent the current point in time for a usage window.
- [x] Compute time-left and elapsed-time information for Codex session and weekly windows.
- [x] Render the elapsed/remaining time in the Codex detail labels.
- [x] Render a dynamic progress-bar notch for the current point in the window.
- [x] Run typecheck.
- [x] Validate the live Codex loader output.
- [x] Mark this follow-up plan completed.

## Detailed implementation plan

1. Extend the subscription usage window type with an optional pace/timeline marker percent.
2. Update the subscriptions dialog so it can project that marker into the current display mode (`used` vs `remaining`) and pass it into the progress bar notches.
3. Update the Codex provider to compute reset time, inferred start time, elapsed percent, and time remaining for both the session and weekly windows.
4. Include the time-left information in the user-visible window detail labels.
5. Add a note clarifying that the notch marks the current point in the time window.
6. Run typecheck and live-loader validation to confirm the returned values are sensible.

## Risks / questions

- The current UI uses the same left-to-right bar for both `used` and `remaining` display modes, so the dynamic notch must be transformed consistently for each mode.
- The provider may sometimes return only reset timestamps without enough information to infer precise elapsed time; in those cases the notch should be omitted rather than guessed.
- Adding too much detail text could make the narrow TUI wrap more often, so labels should stay compact.

## Validation

- `npm run typecheck`
- run the Codex runtime loader and confirm session/weekly windows include time-left detail
- confirm the progress-bar notch percent is present in the returned window model and renders in the dialog

## Outcome summary

The Codex session and weekly windows now include time-left detail and a dynamic progress-bar notch.

What changed:
- added `pacePercent` to `SubscriptionUsageWindowDefinition`
- updated the subscriptions dialog to project the dynamic pace notch into both `used` and `remaining` display modes
- updated the Codex window builder to compute:
  - `resetAt`
  - inferred elapsed time in the current window
  - time remaining until reset
  - `pacePercent` for the current time position in the window
- added a Codex note explaining that the notch marks the current point in the active time window

Live validation result:
- session window currently reports about **3h 21m left** with the notch at about **33%** of the 5-hour window elapsed
- weekly window currently reports about **6d 22h left** with the notch at about **1%** of the 7-day window elapsed