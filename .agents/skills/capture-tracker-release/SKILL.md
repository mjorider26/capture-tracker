---
name: capture-tracker-release
description: Production release workflow for Capture Tracker covering preflight checks, CI, migrations, deployment, smoke testing, production verification, rollback awareness, git discipline, and evidence-based completion reporting.
---

# Capture Tracker Release

Use this skill when work is being prepared for commit, push, CI, deployment, production validation, or release completion.

Production is the default deployment target unless the user explicitly requests otherwise or the provider requires isolation.

## Preflight

Before release:

1. Read AGENTS.md.
2. Inspect git status.
3. Confirm the intended branch.
4. Review the diff.
5. Confirm unrelated user work was not modified.
6. Identify database/schema changes.
7. Identify secret/config changes.
8. Identify deployment dependencies.

Do not blindly deploy whatever happens to be in the working tree.

## Required verification

Determine checks from the actual change.

Consider:

- targeted tests
- full relevant test suites
- TypeScript
- lint
- production build
- Prisma validation
- migration validation
- accounting integrity checks
- auth/security tests
- secret scanning

Fix failures caused by the change.

Do not hide unrelated failures. Report them separately.

## Database releases

If migrations are involved:

1. inspect migration SQL
2. assess destructive operations
3. confirm ordering
4. confirm constraints/triggers remain correct
5. consider existing production data
6. verify migration compatibility with deployed code

Never reset or wipe production to make deployment easier.

## Secrets and configuration

Before deployment ensure required configuration exists without printing secret values.

Never include secrets in:

- terminal summaries
- commits
- screenshots
- release notes
- logs intentionally exposed to the user

## Commit discipline

Commit only intended changes.

Use a concise descriptive commit message.

After committing record the exact SHA.

When CI matters, verify CI against the intended commit rather than assuming a later/different commit proves it.

## Production deployment

Deploy the intended verified version.

Avoid touching unrelated provider resources.

Do not create staging work unless:

- explicitly requested, or
- technically required by the provider/platform

If platform constraints force staging/isolation, explain the reason.

## Post-deploy verification

After deployment verify supported production behavior.

Possible checks include:

- application readiness
- authentication boundary
- critical page/API availability
- expected database connectivity
- key workflows affected by the change
- deployed version/SHA where available

Do not perform destructive production testing.

## Physical upload limitation

Do not stop the release solely because an owner-performed physical upload cannot be executed.

Instead:

- run automated tests
- run integration tests
- run supported production checks
- validate upload logic where technically possible

Label the owner-upload path:

"Assumed / not physically verified"

Never label it PASS unless it was actually verified.

## Failure handling

If production verification fails:

1. identify whether the failure was introduced by this release
2. preserve evidence
3. avoid random production changes
4. determine the safest correction
5. re-run relevant checks

Do not mask a failed deployment with optimistic language.

## Completion criteria

A release is complete only when there is evidence for the claims being made.

Final report should include:

- source commit SHA
- CI/check status
- deployment result
- production verification performed
- migration status when relevant
- known limitations
- anything assumed/not physically verified

Use PASS only for checks actually performed successfully.
