# DevFlow AI

DevFlow AI is a developer workflow platform built with the MERN stack. It brings project and issue tracking, team management, an API tester, and a rule-based code review tool into one workspace.

## Key features

- **JWT authentication:** developers can register and sign in; the client stores the token in session storage.
- **Admin and Developer roles:** the server checks roles on protected routes and applies access rules to workspace data.
- **One-time Initial Admin bootstrap:** a server command creates the first Admin from temporary environment inputs and refuses repeat setup.
- **Admin user management:** Admins can promote, demote, deactivate, reactivate, and remove users. The server protects the last active Admin from demotion, deactivation, or removal.
- **Audit logs:** Admins can review recent account, issue, and bootstrap events. Audit writes are best effort so a logging failure does not fail the main action.
- **Projects:** signed-in users can create and list projects they can access, read a project, and update or archive projects they own; Admins can manage any project.
- **Issues:** issues are linked to projects and have title, description, status, and priority. Users can create, list, filter, and read issues in visible projects. Developers can update or delete issues they reported; Admins can manage any issue.
- **Dashboard summary:** live project and open-issue counts are scoped to the signed-in user's visible projects. Admins also see the number of active Developer accounts.
- **Team page:** signed-in users can see active team members and contribution counts. Only Admin responses include member email addresses.
- **Profile management:** users can edit their own name and change their password.
- **API Tester:** signed-in users can send HTTP requests to public destinations and save private request definitions. The server blocks local and private network destinations, validates and pins resolved addresses, does not follow redirects, and limits request time and response size.
- **Rule-based Code Review:** deterministic checks return findings and history. Submitted source code is neither stored nor executed.
- **Landing page and responsive workspace:** the client includes a public landing page and a responsive signed-in application shell.

## Not implemented / planned

- Google or GitHub sign-in, password recovery, and notifications.
- Pull request or source-control integrations.
- AI or LLM-based code review. **Code Review is rule-based; it does not call an AI model.**
- Project progress charts.

## Technologies

- React 19 and Vite
- Node.js and Express 5
- MongoDB with Mongoose
- JSON Web Tokens (JWT) and bcrypt
- Zod validation, Helmet security headers, and express-rate-limit
- Backend tests with node:test, Supertest, and mongodb-memory-server
- Client tests with Vitest and Testing Library
- oxlint

## Prerequisites

- Node.js 22.12.0 was used to verify this repository. The package manifests do not declare a Node engine range.
- npm
- A local MongoDB service running and reachable by the backend

## Setup and installation

Clone the repository and install the dependencies separately for the server and client.

### Windows PowerShell

~~~powershell
git clone https://github.com/MrSumitbhoi1307/DevFlow-AI.git
Set-Location DevFlow-AI

Set-Location server
npm install
Set-Location ..

Set-Location client
npm install
Set-Location ..

Copy-Item server/.env.example server/.env
~~~

### macOS and Linux

~~~sh
git clone https://github.com/MrSumitbhoi1307/DevFlow-AI.git
cd DevFlow-AI
cd server && npm install
cd ../client && npm install
cd ..
cp server/.env.example server/.env
~~~

Edit server/.env and configure the variables used by the backend:

| Variable | Purpose |
| --- | --- |
| PORT | Backend port; defaults to 5000. |
| CLIENT_ORIGIN | Allowed browser origin; defaults to http://localhost:5173. |
| MONGODB_URI | MongoDB connection string; the example targets a local database. |
| JWT_SECRET | Replace the example with a long random secret of at least 32 characters. |

For example, the copied file contains placeholder values in this shape:

~~~dotenv
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/devflow_ai
JWT_SECRET=replace-with-a-long-random-value-of-at-least-32-characters
~~~

The JWT value above is only a placeholder; replace it with a securely generated value before starting the server. Local .env files are ignored by Git. Do not commit real credentials.

## Run the application

Start MongoDB first. In one terminal, start the API:

~~~powershell
Set-Location server
npm run dev
~~~

In a second terminal, start Vite:

~~~powershell
Set-Location client
npm run dev
~~~

The client is expected at http://localhost:5173 and the API at http://localhost:5000. The API health endpoint is http://localhost:5000/api/health. To run the backend without the development watcher, use npm start from server/.

### Create the Initial Admin

The bootstrap command is run once from the server directory:

~~~powershell
npm run bootstrap:admin
~~~

It reads MONGODB_URI from server/.env and requires INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD in the command's process environment. Supply those three values temporarily; do not put the password in a committed file or in this README. This PowerShell example prompts for the password as a SecureString and only places the temporary plaintext value in the process environment while the bootstrap command runs:

~~~powershell
$env:INITIAL_ADMIN_NAME = Read-Host "Initial Admin name"
$env:INITIAL_ADMIN_EMAIL = Read-Host "Initial Admin email"
$securePassword = Read-Host "Initial Admin password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $env:INITIAL_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    npm run bootstrap:admin
    $bootstrapExitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:INITIAL_ADMIN_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:INITIAL_ADMIN_EMAIL -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $securePassword.Dispose()
}

if ($bootstrapExitCode -ne 0) {
    throw "Initial Admin bootstrap failed."
}
~~~

The password must be 10–128 characters and contain a lowercase letter, an uppercase letter, and a number. Bootstrap refuses to run again after success or when an active Admin already exists.

## API overview

All routes are mounted by the Express app. “Signed in” means a valid Bearer JWT for an active account. Admin-only access is enforced by the server.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | / | Public | API status response |
| GET | /api/health | Public | Database connection health |
| POST | /api/auth/register | Public | Register a Developer |
| POST | /api/auth/login | Public | Sign in and receive a JWT |
| GET | /api/auth/me | Signed in | Read the caller's public profile |
| PATCH | /api/auth/me | Signed in | Update the caller's name |
| POST | /api/auth/change-password | Signed in; rate limited | Change the caller's password |
| GET | /api/admin/users | Admin | List users |
| GET | /api/admin/audit-logs | Admin | Read recent audit entries; optional action filter |
| PATCH | /api/admin/users/:userId/role | Admin | Promote or demote a user |
| PATCH | /api/admin/users/:userId/status | Admin | Activate or deactivate a user |
| DELETE | /api/admin/users/:userId | Admin | Remove a user |
| GET | /api/projects | Signed in | List projects visible to the caller |
| POST | /api/projects | Signed in | Create a project |
| GET | /api/projects/:projectId | Signed in; project must be visible | Read a project |
| PATCH | /api/projects/:projectId | Project owner or Admin | Update or archive a project |
| GET | /api/issues | Signed in | List issues in visible projects; optional project filter |
| POST | /api/issues | Signed in; project must be visible | Create an issue reported by the caller |
| GET | /api/issues/:issueId | Signed in; linked project must be visible | Read an issue |
| PATCH | /api/issues/:issueId | Admin or reporting Developer | Update an issue |
| DELETE | /api/issues/:issueId | Admin or reporting Developer | Delete an issue |
| GET | /api/dashboard/summary | Signed in | Count visible projects and open issues; Admins also receive active Developer count |
| GET | /api/team | Signed in | List active members and contribution counts; emails are included only for Admins |
| POST | /api/api-tester/send | Signed in; rate limited | Send a validated request to an allowed public destination |
| GET | /api/api-tester/saved | Signed in | List the caller's saved requests |
| POST | /api/api-tester/saved | Signed in | Save a request for the caller |
| DELETE | /api/api-tester/saved/:savedRequestId | Signed in; owner only | Delete the caller's saved request |
| POST | /api/code-review | Signed in; rate limited | Run deterministic rule checks and save the result |
| GET | /api/code-review/history | Signed in | List the caller's review history |
| DELETE | /api/code-review/history/:reviewId | Signed in; owner only | Delete the caller's review |

## Tests, build, and lint

The following commands were run from their respective package directories:

- Server: npm test — **90 passed, 0 failed**.
- Client: npm test — **40 passed, 0 failed**.

Run them again with:

~~~sh
cd server
npm test

cd ../client
npm test
npm run build
npm run lint
~~~

The verified build and lint commands are defined in client/package.json. The test counts above are from the current repository state at the time this README was updated.

## Security notes

- Passwords are hashed with bcrypt before storage. Public user responses include createdAt and omit the password hash.
- JWT authentication and Admin/Developer authorization are enforced by the server. The client also hides Admin-only navigation from Developers.
- Helmet is enabled. express-rate-limit is applied to password changes, API Tester outbound requests, and Code Review submissions.
- The API Tester accepts only HTTP and HTTPS, rejects embedded URL credentials and non-public resolved addresses, connects using the validated address, and does not follow redirects. It strips credentials, cookies, and hop-by-hop headers from outbound requests. Requests time out after 8 seconds; response text is capped at 1 MB.
- Code Review analyzes submitted text using deterministic rules. It never evaluates or executes the submitted code and does not store the source text.
- Keep database credentials and JWT secrets in the local server/.env file. Git ignores local .env files; server/.env.example contains placeholders only.

## Troubleshooting

- **CORS error in the browser:** Vite uses port 5173 by default, and the API allows CLIENT_ORIGIN (default http://localhost:5173). Stop an old Vite server if it took 5173, or set CLIENT_ORIGIN in server/.env to the actual client origin, then restart the API.
- **MongoDB connection or health check fails:** make sure the local MongoDB service is running, MONGODB_URI in server/.env points to it, and the database host and port are reachable.

## Code0 development

This project was built using Code0 (CodeZero) throughout development, including Git and GitHub operations performed through the Code0 terminal.

### AI Development Experience

I used a plan, approve, run, and verify loop with Code0. It helped me scaffold features, write tests, and find the causes of test failures quickly. Human review was still needed: I resolved branch divergence and merge conflicts, corrected test setup issues such as missing jest-dom matchers and stale fetch mocks, checked browser behavior myself, and fixed CORS problems caused by Vite using a different port.

### Where Code0 helped

- **Initial Admin and Admin protection:** Code0 helped with server/scripts/create-initial-admin.js, server/services/bootstrapAdmin.js, and the last-active-Admin rule in server/routes/admin.js.
- **Safe API Tester:** it helped implement server/services/apiTester.js and the API Tester routes, including SSRF checks, validated-address connection, redirect handling, and request limits.
- **Rule-based Code Review:** it helped build server/services/codeReview.js and its tests for the static rules; this review does not call an LLM or execute submitted code.
- **Audit trail:** it helped connect best-effort audit writes in server/services/auditLog.js to Admin, issue, and bootstrap actions, with tests checking what metadata is exposed.
- **Profile management:** it helped implement the self-service endpoints in server/routes/auth.js and client/src/ProfilePage.jsx, including name updates, password changes, and tests for validation and error cases.

### My contribution

I chose the project scope and features, reviewed and approved each plan, created the Initial Admin through the bootstrap flow, and manually tested the features in the browser. I resolved merge conflicts and CORS/port issues, managed branches and GitHub pull requests, and can explain how the implementation works.
