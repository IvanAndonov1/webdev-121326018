# StudySync

## Project option
Study groups.

## Goals
- Help students find or create study groups around a topic, deadline, or course.
- Let a signed-in student review nearby groups, create a new group, and remove one they created.
- Keep the app easy to run in Codespaces with a local PostgreSQL database and simple browser-based flows.

## Non-goals
- We are not building Google OAuth or other social sign-in for Exercise 2.
- We are not implementing a model-powered recommender or AI-generated summaries yet.
- We are not building a production-ready multi-tenant backend or a distributed cache.
- We are not building chat, scheduling, or calendar integrations in this slice.
- We are not building mobile-native clients or a desktop app.

## Constraints
- The application must run in a simple Node.js and PostgreSQL setup, with no extra framework beyond Express.
- Every request must be accountable to the database state and the authenticated user context.
- The code must be safe against direct HTML injection from stored group names and descriptions.
- The repository must keep the Exercise 1 MCP server working without changing its contract.

## The model feature
- Model: Gemini 2.5 Flash, or a similar hosted model selected via environment configuration.
- Input: the user provides a course topic, weak area, or study goal, and the app asks the model for suggestions.
- Output: the model returns a small list of group names or revision prompts labeled as suggestions, never as facts the app already knows.
- When it fails: the app shows a friendly fallback message, keeps the rest of the screen usable, and does not block the user from browsing study groups.

## Auth
- Local: the app uses email and password sign-in against the `users` table in PostgreSQL.
- Provider: Google OAuth is planned as a later project feature, but this Exercise 2 slice does not implement it yet.
- Linking: a user who signs in with both local and provider-based auth is treated as the same account when the email matches, and that logic is verified during future auth work.

## MCP tools
| Tool | What it does | Who may call it |
| --- | --- | --- |
| `list_groups` | Lists all study groups with their names, descriptions, and timestamps. | Signed-in members and the app's own admin workflows. |
| `find_group` | Finds one study group by its name or identifier and returns its details. | Signed-in members. |
| `create_group` | Creates a new group and stores the database row if the data is valid. | Signed-in members. |
| `delete_group` | Removes a group row from the database after verifying the caller is allowed to change it. | Signed-in members and admin workflows. |

## UI
- Stack: Node.js, Express, PostgreSQL, HTML, CSS, and a small browser script with no extra framework.
- Screens: login page, protected study-groups page, group create form, and empty/error states for the list.
- The app keeps the main flow keyboard-friendly, uses visible focus styles, and avoids unsafe HTML interpolation when displaying stored values.

## Architecture
- `server.js` boots the app and initializes the database schema.
- `src/app.js` handles Express routes, login/logout flows, auth guarding, and authenticated API endpoints.
- `src/db.js` owns the database queries, the schema bootstrap, and the deterministic seed logic for development.
- `public/groups.html` and `public/groups.js` render and update the study-groups page in the browser.
- The Exercise 1 MCP server in `mcp-server/server.js` stays separate and is not used as a direct database layer for the web app.

## Acceptance criteria
- [AC-1] A registered student can sign in with a valid local email and password and is redirected to the study-groups page.
- [AC-2] A student who enters an invalid email or password sees a 401-level authentication failure and no authenticated session is created.
- [AC-3] The database stores at least users, courses, study groups, and group memberships with valid foreign keys.
- [AC-4] A study group belongs to exactly one course and exactly one owner.
- [AC-5] The application has at least one many-to-many user-to-group membership relationship.
- [AC-6] Google or another provider-based sign-in and secure account linking are implemented in the full project.
- [AC-7] The full project provides at least three UI screens and keyboard-visible focus.
- [AC-8] The full project integrates a hosted model and displays a timeout or fallback message for provider failures.
- [AC-9] The full project exposes at least three project-specific MCP tools through the Exercise 1 server boundary.
- [AC-10] The full project exposes a REST API and enforces server-side authorization.

### Slice 1: sign-in and study-groups list
- [AC-11] A signed-in student can fetch a database-backed list of groups with course and owner information.
- [AC-12] A signed-in student can create a group that is owned by that student's authenticated user record.
- [AC-13] Only the owner can delete a group; another authenticated user receives 403 and the unauthenticated response is 401.
- [AC-14] A successful login regenerates the session ID before the user is attached to the session.
- [AC-15] Logging out destroys the server-side session and clears the browser cookie that identifies it.
- [AC-16] A direct request to `/groups.html` or `/api/groups` without a valid session is rejected with the appropriate redirect or 401.
- [AC-17] Malicious HTML stored in a group name or description is rendered as text by browser code instead of executing.
- [AC-18] Database setup is repeatable and test state is isolated, resetting only the dedicated test database.

## Traceability
| Criterion | Test |
| --- | --- |
| AC-1 | `tests/app.test.js` valid local login |
| AC-2 | `tests/app.test.js` invalid password rejection |
| AC-3 | `tests/app.test.js` course, group, and membership database relationships |
| AC-4 | `tests/app.test.js` group course and owner foreign keys |
| AC-5 | `tests/app.test.js` unique many-to-many membership |
| AC-6 | Specification only; provider linking is a future project criterion |
| AC-7 | Specification only; additional screens are a future project criterion |
| AC-8 | Specification only; model integration is a future project criterion |
| AC-9 | MCP checker and specification tool table |
| AC-10 | `tests/app.test.js` API and server-side ownership authorization |
| AC-11 | `tests/app.test.js` authenticated database-backed group list |
| AC-12 | `tests/app.test.js` group creation assigns authenticated owner |
| AC-13 | `tests/app.test.js` owner, forbidden, unauthenticated, and missing deletion outcomes |
| AC-14 | `tests/app.test.js` session fixation prevention |
| AC-15 | `tests/app.test.js` logout destroys session and clears cookie |
| AC-16 | `tests/app.test.js` protected page and API authentication |
| AC-17 | `tests/app.test.js` malicious HTML is treated as text |
| AC-18 | `tests/app.test.js` database reset and repeatable setup |

## Spec vs result
- Passed criteria: A local sign-in flow exists, authenticated API calls work against PostgreSQL, unauthenticated requests are rejected, session fixation prevention is tested, logout clears the session, and the browser script uses text-only rendering instead of `innerHTML`.
- Missed or corrected behavior: Passwords now use bcrypt instead of unsalted SHA-256, the schema includes courses and memberships with ownership, and deletion is authorized on the server. The original two-table implementation and duplicate Slice 1 identifiers were corrected.
- Actual specification refinement after testing: Full-project criteria remain the first ten and uniquely numbered. Slice 1 criteria start at AC-11 so the vertical slice is observable, testable, and distinct from future provider, model, and MCP work.
