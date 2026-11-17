# StudySync

## Project option
Study groups.

## Goals
- Help students quickly find study groups for the courses they are enrolled in and see the group schedule before they commit.
- Let course leaders or group owners create and maintain a small, course-specific study community with a clear membership cap and a simple meeting plan.
- Give a student one place to sign in, view relevant groups, and keep their account session secure while browsing protected data.

## Non-goals
- No payment flow, premium membership tier, or external billing integration.
- No native mobile app or desktop client; the product is browser-based only.
- No video chat, whiteboard, or video-conferencing service is hosted by the application.
- No automated email notification service or campaign system is part of the initial product.

## Constraints
- The application stack is Node.js, Express, PostgreSQL, and vanilla browser JavaScript with session-based local authentication.
- Passwords are stored as bcrypt hashes, never in plaintext, and server-side authorization checks run on every protected request.
- Data persistence is in PostgreSQL, and every list screen used by the app reads from real database rows rather than static in-memory arrays.
- Sensitive credentials are kept in environment variables and never committed to the repository; production and local values are separated by `.env` and `.env.example`.

## The model feature
- Model: Google Gemini 2.5 Flash via a server-side API call that is optional and guarded by a deterministic fallback.
- Input: The app sends only the course code, the topic shortlist, the session duration, and the group goal, without personal student data beyond the request context needed for the feature.
- Output: The app shows a suggested agenda with topic blocks, a recommended pacing plan, and a short note explaining that it is a recommendation rather than a fact.
- When it fails: If the API key is missing, the provider is down, the request times out, or the model returns unusable JSON, the app falls back to a manual agenda template and clearly labels the output as a suggestion.

## Auth
- Local: A student signs in with an email address and password. The password is hashed with bcrypt before storage, and the app validates the hash on each login attempt.
- Provider: The application supports Google OAuth via a server-side authorization-code flow so a user can sign in with a verified Google identity when configured.
- Linking: A local account and Google account are linked only after the provider email is verified and matched to an existing account owner or a newly created account using a same-person check; no blind merge on unverified email addresses is permitted.

## MCP tools
| Tool | What it does | Who may call it |
| --- | --- | --- |
| list_study_groups | Lists all visible study groups with course, time, and membership summary for an authenticated user. | Any authenticated student and group owner |
| my_study_groups | Shows only the study groups a student currently belongs to, along with their chosen role in each group. | Any authenticated student |
| join_study_group | Joins an open study group if the student is eligible and the membership cap has not been reached. | Any authenticated student |

## UI
The frontend is a lightweight server-rendered and fetch-driven web app using Express plus vanilla JavaScript and CSS. The eventual experience includes at least these screens: a sign-in screen, a study-groups dashboard, and a group detail or ownership-management screen. Each screen handles all four states: loading, empty, error, and success. The design stays readable on narrow mobile widths and preserves clear focus styles for keyboard users.

## Architecture
Exercise 3 will trace one request through the full stack: an HTTP route handler receives the request, calls a service function for authorization and business rules, then reads or writes through the data access layer and PostgreSQL. The current Exercise 2 slice intentionally follows the same layering for theLogin and list endpoints; the separate MCP server is preserved as an external interface but it does not bypass this service boundary.

## Acceptance criteria
- [AC-1] A student who has a valid local account can sign in with email and password and receive an authenticated session.
- [AC-2] A student who enters an incorrect password sees a clear validation message and no session is created.
- [AC-3] An unauthenticated user who requests the protected study-groups page or API is redirected or denied with an authorization error.
- [AC-4] A group owner can create a study group for a course with a name, description, location, and meeting time without exposing admin-only data to other accounts.
- [AC-5] A student can view a list of real study groups stored in PostgreSQL, including the course code, group title, description, and meeting details.
- [AC-6] A group membership cap prevents a student from joining once the group is full, and the database records the membership as a single row per user and group.
- [AC-7] A signed-in user who logs out cannot access protected group data in a later request, and the session cookie is invalidated.
- [AC-8] A seeded user can sign in and see study groups loaded from PostgreSQL on the protected list screen.
- [AC-9] A valid local account can perform a secure sign-in, while invalid credentials are rejected and the protected list remains unavailable without an authenticated session.
- [AC-10] When a study-group row is updated in the database, the authenticated user sees the changed value after refreshing the list without restarting the server.

### Slice 1: sign-in and the study groups list
- [AC-11] An unauthenticated visitor cannot access the protected study-groups list and is redirected to the sign-in screen.
- [AC-12] A valid seeded local account signs in and the list page shows at least three real study groups from the database.
- [AC-13] After a database record is changed, the next authenticated refresh shows the updated data, and the session still remains valid until logout.

## Traceability
| Criterion | Test |
| --- | --- |
| AC-1 | Exercise 3 later |
| AC-2 | Exercise 3 later |
| AC-3 | Exercise 3 later |
| AC-4 | Exercise 3 later |
| AC-5 | Exercise 3 later |
| AC-6 | Exercise 3 later |
| AC-7 | Exercise 3 later |
| AC-8 | `test('AC-8 a seeded student can sign in and view study groups', ...)` |
| AC-9 | `test('AC-9 invalid credentials and unauthenticated access are rejected', ...)` |
| AC-10 | `test('AC-10 database changes are reflected in a refresh after login', ...)` |
| AC-11 | Exercise 3 later |
| AC-12 | Exercise 3 later |
| AC-13 | Exercise 3 later |

## Spec vs result
The Slice 1 implementation delivered the sign-in flow and the protected study-groups list backed by PostgreSQL, including authenticated access rules and database-backed refresh behavior. One genuine refinement emerged during verification: the initial requirements did not explicitly say that the protected list must reject unauthenticated visitors with a clear authorization failure and allow a valid session to remain intact until logout. That edge case was resolved in the final acceptance criteria and the runtime tests so the requirement is precise and verifiable. The future Google OAuth, AI agenda feature, and additional group-management flows remain specified but intentionally not implemented in Exercise 2, which keeps the slice focused and testable.
