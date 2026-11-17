# Instructions for the agent

Read this file at the start of every session. Keep it short and correct; update it when the project changes.

## Project
StudySync is a small study-group application for students who need a safe place to sign in, browse groups, and manage memberships in a single app. See `SPEC.md` for the goals, non-goals, and acceptance criteria.

## Commands
- Install: `npm install`
- Run: `npm start`
- Test: `npm test`
- Coverage: `npm run coverage`
- MCP server: `npm run mcp`

## Conventions
- This repository keeps the Exercise 1 MCP server in `mcp-server/` and the web app at the repository root.
- Route handlers live in `src/app.js`; the database helpers live in `src/db.js`; the browser logic for the groups page is in `public/groups.js`.
- Errors are returned as HTTP status codes and JSON error messages for authenticated API calls. The browser uses redirects for protected pages and a JSON error body for API requests.
- Database schemas and deterministic seed data are kept in `db/schema.sql` and `src/db.js`.

## Layers
The current code does not yet have a full service-layer architecture. The actual flow is:

- HTTP route handler → data access helper → PostgreSQL
- Browser script → authenticated API route → data access helper → PostgreSQL
- MCP tool → isolated JSON-RPC logic in `mcp-server/server.js` and not shared with the web app yet

This repository keeps the course MCP server unchanged; it is a separate interface from the Express app.

## The model feature
- The provider is named in exactly one file: `SPEC.md` under `The model feature`.
- The key comes from the environment and is never committed or logged.
- Every call should timeout and fall back to a safe message when the provider is slow or rate-limited.
- The model output is treated as a suggestion and is shown as such in the UI, not as a fact the app knows.
- Tests do not call the provider; they pass in a fake client or assert the fallback behavior.

## The MCP server
- Lives in `mcp-server/` and grew out of Exercise 1.
- It stays a separate JSON-RPC interface and is not reimplemented as a direct database client from the web app.
- It is started with `npm run mcp` and continues to expose course data tools only.
- Any new tool needs a matching row in `SPEC.md` under the MCP tools table.

## Tests and coverage
- Every acceptance criterion in `SPEC.md` has an id like `AC-3` and a test whose title contains the id.
- The coverage gate is enforced in CI with a 100% service-layer threshold and 80% overall threshold.
- A test is evidence; changing it to pass without the behaviour is not a valid fix.

## Always ask before
- deleting files or folders
- editing a migration that has already run
- installing or removing dependencies
- pushing, tagging or changing CI
- anything that touches secrets or `.env`
- changing an authentication or authorization rule
- adding, renaming or removing an MCP tool
- changing a coverage threshold
- sending user data to a third-party model

## Never
- commit secrets, passwords, API keys or an OAuth client secret
- weaken or delete a test to make it pass
- lower a coverage threshold or switch off a CI job to make the build green
- add an MCP tool that reaches past the service layer
- log a prompt that contains somebody's personal data
