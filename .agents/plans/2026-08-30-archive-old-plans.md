# Archive old root plan files

- **Status:** complete
- **Date:** 2026-08-30
- **Owner:** agent

## Objective

Move old plan files out of `.agents/plans/` root into `.agents/plans/archive/`, then commit and push the cleanup so the root plans directory contains only the README and the current archive task plan.

## Checklist

- [x] Review current `.agents/plans/` contents and existing archive conventions.
- [x] Create/update a plan for this archive task before changing files.
- [x] Move old root-level plan markdown files into `.agents/plans/archive/`.
- [x] Verify the root plans directory only contains the README and this task plan.
- [x] Update this plan with the actual work performed.
- [x] Commit and push the archive changes.

## Detailed implementation plan

1. Inspect the current root-level plan files and confirm the archive directory already exists.
2. Treat all existing dated plan files currently in `.agents/plans/` except the new archive-task plan as old historical plans to archive for this cleanup pass.
3. Move those files into `.agents/plans/archive/` without changing their contents.
4. Verify the resulting directory layout so only `README.md` and this task plan remain at the root.
5. Update this plan to mark the completed steps and record the exact result.
6. Commit the moved files with a focused message and push the branch to `origin/main`.

## Risks / questions

- “Old” is interpreted here as every existing dated root plan file except the new archive-task plan created for this cleanup.
- Moving stale but incomplete plans into archive is intentional for directory hygiene; their history remains preserved in git and under `.agents/plans/archive/`.
- Avoid moving `README.md`.

## Validation

- `find .agents/plans -maxdepth 1` now shows only `README.md` and `2026-08-30-archive-old-plans.md` at the root.
- The previous root plan files were moved into `.agents/plans/archive/` without content changes.
- `git status` should show the new task plan plus a series of renames from `.agents/plans/` to `.agents/plans/archive/` before commit/push.

## Completion notes

- Archived every dated root plan file that existed before this cleanup pass.
- Left `.agents/plans/README.md` and this archive-task plan at the root, matching the requested directory cleanup.
