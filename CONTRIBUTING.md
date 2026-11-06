# Contributing

This is one shared pnpm workspace. Keep a task small, integrate it early, and let another teammate review it.

## Before picking work

1. Pick or create a GitHub issue with a clear outcome and acceptance checks.
2. Check dependencies and agree on the API/data contract with the affected teammate before parallel edits.
3. Assign one driver and one reviewer in the issue. Rotate areas over time so knowledge is shared.

## Branch and pull request

- Start from an updated `main`; use `feature/<issue>-short-name` or `fix/<issue>-short-name`.
- Keep PRs focused on one issue. Do not commit `.env`, credentials, generated build output, `node_modules`, or `.venv`.
- Include what changed, how a reviewer can verify it, screenshots for UI changes, and migration/config/rollback notes when relevant.
- Ask one other teammate to review. Resolve comments and wait for CI to pass before merging. Use squash merge and delete the branch after merge.
- Do not force-push `main` or use it for direct development. Configure GitHub branch protection to require PR review and the CI check after the repository is created.

## Local checks

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

`pnpm test` currently runs the API test suite; the web workspace has no test script yet. Add a focused test with the feature and make the relevant CI gate explicit. For API contract changes, update `docs/api/openapi.yaml` and regenerate web types with `pnpm api:types`.

## Three-person collaboration

Suggested streams and initial boundaries are in [`docs/team/README.md`](docs/team/README.md). They are coordination aids, not permanent ownership silos. All three members can review/change any area; rotate the driver and reviewer between increments.

## Environment files

- Root `.env.example`: Compose/local stack sample.
- `apps/api/.env.example`: API-native local run sample.
- `apps/api/.env`: local secret/config; ignored and must stay out of commits.

Copy the appropriate example for the run mode. If a variable changes, update the example and README; never put real secrets in examples, issues, logs, or PRs.
