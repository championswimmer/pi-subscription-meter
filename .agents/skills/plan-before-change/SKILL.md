---
name: plan-before-change
description: Create or update a detailed implementation plan in .agents/plans before making non-trivial repository changes. Use when starting a feature, refactor, integration, or other multi-step task so work begins with a checklist and a step-by-step implementation plan.
compatibility: Repositories that keep repo instructions in AGENTS.md and plans in .agents/plans.
---

## Goal

Every meaningful task in this repository starts with a written plan.

Before making changes, create or update a plan file in `.agents/plans/` and keep it current while work is being executed.

## Required workflow

1. Read `AGENTS.md`.
2. Check whether a matching plan already exists in `.agents/plans/`.
3. If not, create a new plan file named `YYYY-MM-DD-short-task-name.md`.
4. Add a checklist of concrete tasks.
5. Add a detailed step-by-step implementation plan before editing code.
6. Record assumptions, open questions, risks, and validation steps.
7. As work progresses, update the checklist and notes.
8. Close the task with the plan reflecting what was actually done.

## Minimum plan structure

Use this structure unless the task clearly needs more detail:

- Title
- Status
- Objective
- Checklist
- Detailed implementation plan
- Risks / questions
- Validation

A reusable template is available at `assets/plan-template.md`.

## Planning standards

- Checklist items should be specific and observable.
- Implementation steps should be detailed enough that another agent could continue the work.
- Note external dependencies, auth requirements, and unknowns early.
- If work touches provider usage or subscription APIs, also load `../api-subscription-research/SKILL.md` and its references.
- If a task expands significantly, update the existing plan instead of keeping stale notes in chat only.

## Output expectation

Do not jump straight into editing code for non-trivial tasks.
Create the plan first, then execute against that plan.
