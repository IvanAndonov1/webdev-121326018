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
- [AC-3] A signed-in student can fetch the list of study groups from the database and see the rows returned in the API response.
- [AC-4] A signed-in student can create a new group and the new row appears in the `study_groups` table.
- [AC-5] A signed-in student can delete a group and the group disappears from the list in later authenticated requests.
- [AC-6] A direct request to `/groups.html` without a valid session is redirected to `/login`.
- [AC-7] The `/api/groups` route rejects unauthenticated requests with HTTP 401 and a readable error message.
- [AC-8] A successful login regenerates the session ID before the user is attached to the session.
- [AC-9] Logging out destroys the server-side session and clears the browser cookie that identifies it.
- [AC-10] Malicious HTML stored in a group name or description is rendered as text by browser code instead of executing.

### Slice 1: sign-in and study-groups list
- [AC-8] A successful login regenerates the session ID before the user is attached to the session.
- [AC-9] Logging out destroys the server-side session and clears the browser cookie that identifies it.
- [AC-10] Malicious HTML stored in a group name or description is rendered as text by browser code instead of executing.

## Traceability
| Criterion | Test |
| --- | --- |
| AC-1 | `tests/app.test.js` login flow and authenticated group list checks |
| AC-2 | `tests/app.test.js` invalid login rejection |
| AC-3 | `tests/app.test.js` authenticated request sees database changes |
| AC-4 | `tests/app.test.js` create group via authenticated API |
| AC-5 | `tests/app.test.js` delete group removes it from list |
| AC-6 | `tests/app.test.js` protected study-groups page redirect |
| AC-7 | `tests/app.test.js` unauthenticated API rejection |
| AC-8 | `tests/app.test.js` session fixation prevention |
| AC-9 | `tests/app.test.js` logout destroys session and cookie |
| AC-10 | `tests/app.test.js` malicious HTML is treated as text |

## Spec vs result
- Passed criteria: A local sign-in flow exists, authenticated API calls work against PostgreSQL, unauthenticated requests are rejected, session fixation prevention is tested, logout clears the session, and the browser script uses text-only rendering instead of `innerHTML`.
- Missed or corrected behavior: The repository started without the project code, so the app had to be rebuilt around the required Exercise 2 features rather than fixing a partially completed implementation. The original template had no study-groups logic or tests, and the auth/session implementation was written to match the real code paths that exist now.
- Actual specification refinement after testing: We kept the core study-groups slice and tightened the acceptance criteria so each one is directly testable in under a minute. Criteria AC-8, AC-9, and AC-10 are now the implemented Slice 1 criteria; the remaining acceptance criteria cover the whole project and remain distinct from future Exercise 3/4 work.
