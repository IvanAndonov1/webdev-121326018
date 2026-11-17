
# Agent Log

This file records interactions with AI agents during the Web Development course.

## 2026-10-27 · MCP Server Implementation

- **Goal:** Implement a working MCP server using Node.js without an MCP SDK or framework.
- **Delegated:** Asked ChatGPT to explain the JSON-RPC protocol, review the implementation, and help troubleshoot errors.
- **Checkpoints:** Successfully implemented initialization, tool discovery, tool execution, and error handling. The server passed all 12 self-checks.
- **Went wrong:** Initially encountered incorrect file paths and confused the error handling for unknown tools with unknown JSON-RPC methods.
- **Changed by hand:** Corrected the `callTool()` and `handle()` functions, added error handling, and verified the responses using the course checker.

## 2026-10-27 · Gemini CLI Integration

- **Goal:** Connect Gemini CLI to the MCP server and verify that an AI agent can discover and use its tools.
- **Delegated:** Asked ChatGPT for help diagnosing slow responses and interpreting Gemini CLI debug logs.
- **Checkpoints:** Gemini CLI successfully connected to the MCP server named `my-project` and discovered both `find_lecture` and `count_lectures`.
- **Went wrong:** Gemini CLI failed to complete model requests. Debug logs showed repeated HTTP 503 `UNAVAILABLE` errors indicating high demand for the selected model. Even a simple arithmetic question failed to complete.
- **Changed by hand:** Tested different models, enabled debug logging, and inspected the API errors. No changes to the MCP server implementation were necessary.
- **Result:** MCP connection and tool discovery succeeded. Actual tool execution by Gemini remains unverified because of the model API failures.

## 2026-10-27 · npm Start Command

- **Goal:** Configure a standard command for starting the MCP server.
- **Delegated:** Asked ChatGPT to explain the npm configuration and verification steps.
- **Checkpoints:** Created `package.json`, added the `mcp` script, and successfully ran the course self-check through npm.
- **Went wrong:** No issues encountered.
- **Changed by hand:** Added the npm script and verified that `npm run --silent mcp` starts the server correctly.
- **Result:** All 12 self-checks passed.

## 2026-11-17 · Exercise 2 Slice 1 implementation

- **Goal:** Build the required Exercise 2 specification and a working first slice for sign-in and the study-groups list, then verify it against the repo checker and real runtime behavior.
- **Delegated:** Used the coding agent to inspect the repository, implement the app stack, and validate the database-backed auth flow.
- **Checkpoints:** Selected the Study Groups project, created the protected HTML flow, implemented PostgreSQL-backed authentication, seeded real users and study groups, and added automated tests covering login, invalid credentials, unauthenticated access, and database refresh behavior.
- **Went wrong:** The repository initially had no app implementation, and the first test run failed because the app module was not yet created. The database also had to be created and initialized locally before runtime checks could pass.
- **Changed by hand:** Added the Express app, PostgreSQL migration and seed setup, the login and groups pages, the session-based auth layer, and the automated tests. I also refined the specification to make the unauthenticated access and session lifecycle rules explicit.
- **Verification checkpoints:** Ran the Slice 1 test file in red state, then implemented the fix and reran the tests until they passed. Afterwards, I checked the runtime flow by starting the app, logging in with the seeded account, and fetching the protected list.
- **Result:** The app now supports sign-in, protected list access, real database data, logout, and end-to-end verification against the seeded PostgreSQL data.
