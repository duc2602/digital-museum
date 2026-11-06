# Three-person work split

Use one shared backlog and deliver vertical slices. The tracks below help coordinate parallel work; they do not assign each person to one code folder for the whole project.

| Track | Typical first driver | Work examples | Pairing boundary |
|---|---|---|---|
| API and data | Member A, rotate next increment | domain rules, auth/permissions, API endpoints, schema/migrations, audit | Agree OpenAPI and migration impact with web/platform before coding. |
| Web experience | Member B, rotate next increment | admin screens, forms, public browse/search, responsive states | Start against agreed API contract; use mock data only until endpoint lands. |
| Integration and quality | Member C, rotate next increment | CI, test scenarios, Docker/dev environment, backup/restore notes, demo flow | Own an end-to-end story too; do not become the only tester or release person. |

Replace A/B/C with the group's own assignment in the task board; no names are assumed here. For each story, one driver implements it, a different member reviews the PR, and the third helps test or unblock. Rotate these assignments each sprint. For cross-cutting changes (workflow, permissions, schema, API contract), agree on the design together before splitting subtasks.

## Shared habits

- Use one root Git repository and one `main` branch; keep work in short-lived issue branches.
- Keep `main` buildable. Merge small PRs as soon as CI and review pass; integrate API/web changes continuously.
- Agree on field names, status enums, error responses and ownership rules before parallel API/UI work.
- Keep tasks small enough that a teammate can review them in one sitting. Avoid two people editing the same module without a quick agreement.
- Update the issue when scope/AC changes; show working behavior at review, not only completed task checkboxes.
- Track unresolved stack choice (the written brief says Python, current app is NestJS) as one team decision; this starter keeps the existing stack until the team explicitly decides otherwise.
