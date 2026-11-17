
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

## 2026-11-17 · Project Orientation

- **Goal:** Read the course scaffolding and understand how the repository is organized before implementing the remaining exercises.
- **Delegated:** Reviewed the repository-level documentation, the exercise check scripts, and the existing MCP server implementation.
- **Checkpoints:** Confirmed the repository is a course workspace with Exercise 1 in `mcp-server/` and the project work to be done in the root. The root `README.md` explains the expected deliverables, while `SPEC.md` is the place to define the app's goals, acceptance criteria, and architecture.
- **Went wrong:** No implementation work was started; this was an orientation pass only.
- **Changed by hand:** Confirmed the project structure, the CI workflow, and the `mcp` command contract.
- **Result:** The workspace is a blank course scaffold ready for the app specification and the eventual backend/frontend implementation.

## 2026-11-17 · Exercise 2 remediation and verification

- **Goal:** Repair the missing Exercise 2 implementation, fix the CI and security issues described in the review notes, and verify the project works reproducibly.
- **Delegated:** Reviewed the repository state, the course checkers, and the required fix list before building the minimal Project 2 app and validation suite.
- **Checkpoints:** Rebuilt the application around a simple Express + PostgreSQL stack, added a protected study-groups page, implemented local sign-in and session hardening, and verified the browser-side rendering uses safe text nodes.
- **Went wrong:** The repository started without the project code, so the work had to be reconstructed from the exercise requirements instead of patching a pre-existing implementation. The review notes also required explicit Postgres setup in CI and repeatable test isolation.
- **Changed by hand:** Added the app files under `src/`, `public/`, `tests/`, and `db/`, updated GitHub Actions to run PostgreSQL-backed tests and coverage, and corrected the specification and log files to match reality.
- **Result:** The app is ready for Exercise 2 validation with an explicit database setup, secure session handling, protected routes, and regression tests that cover the required behaviors.

## 2026-11-17 · Final Exercise 2 corrections

- **Goal:** Replace SHA-256 password storage with bcrypt, restore the course/group/membership relational model, and enforce study-group ownership authorization without changing Exercise 1 MCP behavior.
- **Checkpoints:** Added bcrypt password hashing and comparison, deterministic course and membership seeding, course and owner foreign keys, transactional owner checks for deletion, owner-aware browser controls, and additional PostgreSQL integration tests.
- **Went wrong:** The first PostgreSQL test run found no local listener on the test port, so the existing test container was started and the suite was rerun.
- **Changed by hand:** Updated `src/db.js`, `src/app.js`, `public/groups.js`, `db/schema.sql`, `SPEC.md`, `AGENT_LOG.md`, and `USAGE.md`; updated acceptance-criteria numbering and traceability.
- **Result:** The local Node test suite passed 15/15 after the PostgreSQL test database was available.
