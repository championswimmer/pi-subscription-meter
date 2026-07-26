# Fix subscription dialog `create` runtime error

- Status: Completed
- Objective: Identify and fix the runtime `Cannot read properties of undefined (reading 'create')` error that happens when opening the subscriptions modal dialog, then validate the extension still typechecks.

## Checklist

- [x] Read repo instructions and planning skill guidance
- [x] Inspect existing plans and relevant subscription dialog/provider files
- [x] Reproduce or pinpoint the failing `create` call and root cause
- [x] Implement a focused fix
- [x] Validate with typecheck and targeted inspection
- [x] Update this plan with the final outcome

## Detailed implementation plan

1. Inspect the subscriptions command, dialog rendering flow, and provider runtime-loading entrypoints to find every `.create(...)` call that can execute when the modal opens.
2. Compare those calls against the installed Pi package exports/runtime behavior to determine whether an import is undefined at runtime or whether a different API should be used.
3. Apply the smallest safe fix in the relevant source file(s), keeping behavior unchanged except for eliminating the runtime crash.
4. Run `npm run typecheck` and any other lightweight verification needed to confirm the fix is consistent with the local Pi APIs.
5. Update this plan with what changed, any assumptions, and validation results.

## Risks / questions

- The root cause was provider-wide: multiple loaders called `AuthStorage.create()` directly.
- This appears consistent with a Pi runtime compatibility mismatch where `AuthStorage` may be unavailable at runtime even though local development types include it.
- The fix now falls back to direct `auth.json` reads and environment variables when the runtime helper is missing, which should degrade gracefully instead of throwing.

## Validation

- `npm run typecheck`
- `node - <<'NODE' ... createSubscriptionAuthStorage() ... NODE`
- Confirmed the dialog/provider loading path now goes through `createSubscriptionAuthStorage()` instead of calling `AuthStorage.create()` directly
