# AGENTS.md

This repository uses two layers of agent guidance:

1. **This `AGENTS.md` file** for repo-specific working rules.
2. **Agent Skills under `.agents/skills/`** for reusable task-specific instructions following the Agent Skills `SKILL.md` format.

## Repo workflow rules

- Before starting implementation work, create or update a plan in `.agents/plans/`.
- Every plan must include:
  - a checklist of tasks
  - a detailed step-by-step implementation plan
- Keep the plan updated as work progresses.
- If the task touches provider quotas, billing, usage, or authentication, use the `api-subscription-research` skill as the source of truth and update its references when new facts are learned.
- Prefer officially documented APIs. If private, internal, preview, or reverse-engineered endpoints are used, label them clearly in plans, code comments, and docs.
- Keep commits small, focused, and descriptive.

## Skill entrypoints

- Planning workflow: `.agents/skills/plan-before-change/SKILL.md`
- Provider research workflow: `.agents/skills/api-subscription-research/SKILL.md`
