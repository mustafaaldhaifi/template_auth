# Project Instructions

## Release Planning

- Read `docs/roadmap.json` before planning or implementing changes. The roadmap can list future releases. Work on the earliest release whose status is not `completed`.
- When I ask to add a release, ask me for the target version, the goal, and the changes I want. Ask only for details I have not already provided.
- Propose an ordered task list before editing the roadmap. Include each task's `id`, `title`, `version`, `type` (`frontend` or `backend`), `changeType` (`add`, `update`, or `remove`), and how I can verify it. Include `structure` for tasks that create or change a database table.
- Keep the target release version fixed. Number new tasks by incrementing the patch number of the previous release. For example, tasks for `0.3.0` start at `0.2.1` when the previous release is `0.2.0`. Use the task versions already recorded in the roadmap when implementing planned work.
- Add the new release to `docs/roadmap.json` only after I approve the proposed plan and the earlier releases are `completed`. If an earlier release is unfinished, tell me which release must be completed first. Initialize a newly added release as `not_started` and its tasks with `done: false`.

## Task Implementation and Review

- Start the first task once the approved release is eligible to begin. Set the release status to `in_progress` when implementation starts.
- Work on one task at a time, in roadmap order. If I ask you to continue, resume the first unfinished task. If that task is awaiting my review, show me how to verify it and wait for my approval.
- After implementing a task, summarize what changed and give me the steps and expected results so I can test it myself on the affected platforms. Share a preview link or screenshots for UI changes when available.
- If I ask for changes, revise the same task and show me the updated result.
- After I approve the task, set `done` to `true` and commit the code and roadmap changes locally. Start the next task only after this approval.
- After I approve the final task, set the release status to `ready_for_review`. Show me how to test the full release and wait for my approval of the release.

## Release Versions and GitHub Push

- After I approve the full release, update the client version to the last approved `frontend` task version and the server version to the last approved `backend` task version. Keep the existing version for any component that has no tasks in the release.
- Set the release status to `completed`, commit the final version and roadmap updates, and tag that commit with the target release version prefixed with `v`, such as `v0.3.0`.
- Push the completed release commits and its tag to GitHub in one final step. Do not push individual tasks or deploy the application as part of this workflow.

## Code Style and File Organization

- Before adding or moving files, inspect the project structure and follow its existing naming and folder conventions.
- Use descriptive names for files, components, and functions so their purpose is clear.
- Give each component and function a clear responsibility.
- Reuse the same React Native components and form logic across web, Android, and iOS whenever they work on all three platforms.
- If a platform needs different behavior, keep that difference in a small component or module and share the rest of the feature.
- Keep feature-specific files together. Put reusable components in the shared components directory when more than one feature uses them.
- Keep API calls out of screen components. Put them in a separate API module.
- Write comments to explain why a decision was made or why a platform-specific exception is needed.
- Keep shared behavior in one place and isolate variant-specific logic so adding a new variant requires minimal changes to existing code.
- Apply SOLID principles when writing or modifying code. Use the simplest design that keeps responsibilities clear and makes the code easy to change and extend.
- Reuse existing components and functions wherever they meet the task's needs. Share common UI elements such as text inputs and screen titles across features.
- Use a consistent design across web, Android, and iOS. Share colors, typography, spacing, and component styles.
- Make web layouts responsive across phone, tablet, and desktop widths. Use flexible widths and keep content readable and controls accessible as the browser resizes, without horizontal page scrolling.
- Write readable code with descriptive names and clear control flow. Add concise documentation comments above functions, components, or modules when their inputs, return values, side effects, or special cases need explanation.

## Database

- Before creating or changing a table, show me its proposed `structure` in the roadmap task, including column names, data types, constraints, defaults, and relationships.
- Use a migration file for each schema change. Match it to the approved `structure` in `docs/roadmap.json`.
- Use a database transaction when multiple writes must succeed together. If any write fails, roll back the entire operation.
- Preserve existing data when changing the schema. If a migration would delete data, explain what would be lost and wait for my approval before applying it.
- Enforce data integrity with database constraints. Use unique constraints for values that must be unique and foreign keys for relationships between tables.
- When a task changes the database schema, give me the migration command for the development database and explain how I can verify the result.
- Once a migration has been merged or applied to a shared database, use a new migration for further schema changes.
- Centralize database connection settings and keep queries in a dedicated data access layer. Switching to another database of the same engine with a compatible schema should require only a connection setting change. If the engine changes, keep engine-specific changes within the data access layer and migrations.

## API

- Before connecting a screen to an endpoint, define the HTTP method, path, request fields, and expected success and error responses.
- Use a shared API client for web, Android, and iOS. Configure the backend base URL in one place and let each environment supply its own URL.
- Validate incoming API requests on the server before processing them or writing to the database. Associate field-specific validation errors with the affected request fields.
- Return errors as `{ error: { code, message, fieldErrors? } }` with an appropriate HTTP status. Use a stable code and a user-facing message. Include `fieldErrors` only for field-specific errors, using request field names as keys and user-facing messages as values.
- Keep API changes backward-compatible with supported client versions. If a change would break them, introduce a versioned endpoint and keep the existing endpoint available during the transition.
- For user-triggered requests, show when a request is in progress, prevent duplicate submissions while it is pending, and show the result when it finishes.
- For protected endpoints, verify the user's session and check permission for the requested action before reading or changing data.
- Wrap successful responses that return data in a `data` field. If a successful operation has nothing to return, use HTTP 204 with an empty body.
