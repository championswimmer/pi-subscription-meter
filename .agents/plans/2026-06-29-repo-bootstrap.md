# Initial repository bootstrap

- **Status:** in-progress
- **Date:** 2026-06-29
- **Owner:** agent

## Objective

Bootstrap this repository as the foundation for a Pi extension that will show API subscription and usage limits, set up repo-level agent guidance, and prepare the GitHub repository for publication.

## Checklist

- [x] Initialize the repository with git, npm, TypeScript, and a placeholder Pi extension entrypoint.
- [x] Add `AGENTS.md` and create the `.agents/` directory structure.
- [x] Add a planning skill that requires plans in `.agents/plans/` before implementation work.
- [x] Add a provider research skill documenting subscription usage endpoints and token-based auth flows.
- [ ] Create the public GitHub repository `championswimmer/pi-subscription-meter` and push the local history.

## Detailed implementation plan

1. Create the baseline package scaffold so the repository is a valid Pi package and future work can be typechecked.
2. Add repo-specific agent instructions in `AGENTS.md`.
3. Add a planning skill plus a reusable plan template so future implementation starts from a tracked written plan.
4. Add a provider research skill that captures known official and unofficial usage/quota endpoints for the initial provider set.
5. Create the GitHub repository, add the remote, and push all commits.

## Risks / questions

- Some provider usage endpoints are official admin APIs, while others are private or reverse-engineered user endpoints. Those need to be labeled carefully.
- OpenCode appears to expose usage in its console, but a stable public usage API may not exist yet.
- License choice has not been finalized yet; repository is currently scaffolded as `UNLICENSED` until explicitly decided.

## Validation

- `npm run typecheck`
- `git status`
- verify `.agents/skills/*/SKILL.md` structure matches Agent Skills conventions
- verify GitHub remote exists and branch is pushed
