# DevFlow AI

DevFlow AI is a MERN developer workspace for the StartupMeu Software Engineer Intern assessment. It combines a React/Vite client with an Express API backed by MongoDB and Mongoose, and provides JWT authentication with server-enforced Admin and Developer roles.

## Key features implemented

- **Registration and login:** accounts are registered as Developers, passwords are hashed with bcrypt, and successful login/register returns a JWT. The client keeps the token in session storage and sends it with authenticated requests.
- **Server-side access control:** protected routes verify JWTs and enforce Admin-only endpoints on the server. Hiding Admin navigation in the client is an additional UI restriction, not a replacement for server authorization.
- **One-time initial Admin bootstrap:** an explicit command creates the first Admin from local environment inputs. A database lock prevents repeated bootstrap, and the bootstrap refuses to run when an active Admin already exists.
- **Admin Users management:** Admins can list users, promote or demote them, deactivate or reactivate accounts, and remove accounts. The API prevents demoting, deactivating, or removing the last active Admin.
- **Projects:** signed-in users can create and list projects. The API also supports reading a project and updating or archiving it; the client includes project creation, listing, editing, and archiving.
- **Issues:** issues belong to a project and include a title, description, status (open, in-progress, or closed), and priority (low, medium, or high). Signed-in users can create and list issues, filter by project and status, change status, and delete issues with a confirmation step. Developers can update or delete only issues they reported; Admins can update or delete issues in any project they can access.
- **Dashboard metrics:** the dashboard loads live data from GET /api/dashboard/summary. It shows the number of projects visible to the signed-in user and their open issues; Admins also see the number of active Developer accounts.
- **Validation and security headers:** Zod validates authentication, Admin user-management, project, and issue request input. Helmet is enabled in the Express app. The express-rate-limit package is installed, but rate-limiting middleware is not applied.
- **Automated tests:** backend API tests use node:test, Supertest, and mongodb-memory-server. Client component tests use Vitest and Testing Library.

## Planned / not implemented yet

- API Tester.
- AI Code Review.
- Team Management beyond Admin Users; the current Team Management navigation and dashboard card are placeholders, not a functional team-management page.
- Audit logs.
- Rate limiting: express-rate-limit is installed but is not applied to the Express app.

## Technologies

- React and Vite
- Node.js and Express
- MongoDB and Mongoose
- JSON Web Tokens (JWT) and bcrypt
- Zod validation
- Helmet
- express-rate-limit (installed; not currently applied)
- Vitest, Testing Library, and jest-dom
- node:test, Supertest, and mongodb-memory-server

## Prerequisites

- Node.js and npm compatible with the installed Vite version.
- A local MongoDB server running and reachable from the API.

## Setup and installation

From the repository root, install the backend and frontend dependencies in their respective folders:

~~~sh
cd server
npm install
~~~

~~~sh
cd client
npm install
~~~

Create the local server configuration from the example file. In PowerShell, run this from the repository root:

~~~powershell
Copy-Item server/.env.example server/.env
~~~

Configure these server environment variables in the local server/.env file:

- **MONGODB_URI** - the connection URI for your local MongoDB.
- **JWT_SECRET** - a long, randomly generated secret of at least 32 characters.
- **PORT** - optional; defaults to 5000.
- **CLIENT_ORIGIN** - optional; defaults to http://localhost:5173.

Do not commit server/.env. The repository ignores local environment files. Initial Admin credentials are entered temporarily for the bootstrap command as described below; do not save the Admin password in a committed file or README.

## Run the application

Start the API from one terminal:

~~~sh
cd server
npm run dev
~~~

Start the client from another terminal:

~~~sh
cd client
npm run dev
~~~

The API defaults to port 5000. Vite normally serves the client at http://localhost:5173. The API health endpoint is http://localhost:5000/api/health; it reports whether the database connection is available.

## Initial Admin setup

Create the first Admin once, after MongoDB is running and server/.env is configured. The bootstrap command reads MONGODB_URI from server/.env and requires INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD in its process environment. It will not create another initial Admin after a successful bootstrap or when an active Admin already exists.

Use a unique password generated and stored in your password manager. The PowerShell flow below prompts for the password without echoing it and passes it only through the current process environment. Run it from the server folder; it does not put a password in a file or command history.

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

The password must be 10-128 characters and include a lowercase letter, an uppercase letter, and a number. Do not paste it into chat, a README, or any committed file. After setup, sign in through the client using the Admin email and the password held in your password manager.

## API overview

All routes below are mounted by the Express application. Authenticated routes require a valid Bearer token. Admin routes additionally require the Admin role. Issue routes also require access to the issue's project; Developers can update or delete only issues they reported.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | / | Public | API status response |
| GET | /api/health | Public | MongoDB connection health |
| POST | /api/auth/register | Public | Register a Developer |
| POST | /api/auth/login | Public | Log in and receive a JWT |
| GET | /api/auth/me | Signed in | Return the current user's public profile |
| GET | /api/admin/users | Admin | List up to 100 users |
| PATCH | /api/admin/users/:userId/role | Admin | Promote or demote a user |
| PATCH | /api/admin/users/:userId/status | Admin | Activate or deactivate a user |
| DELETE | /api/admin/users/:userId | Admin | Remove a user |
| GET | /api/projects | Signed in | List projects visible to the user |
| POST | /api/projects | Signed in | Create a project |
| GET | /api/projects/:projectId | Signed in | Read a visible project |
| PATCH | /api/projects/:projectId | Owner or Admin | Update or archive a project |
| GET | /api/issues | Signed in, visible projects | List issues; the client also filters by status |
| POST | /api/issues | Signed in, visible project | Create an issue in a visible project |
| GET | /api/issues/:issueId | Signed in, visible project | Read an issue in a visible project |
| PATCH | /api/issues/:issueId | Admin or reporting Developer | Update issue fields; Developers may change only issues they reported |
| DELETE | /api/issues/:issueId | Admin or reporting Developer | Delete an issue; Developers may delete only issues they reported |
| GET | /api/dashboard/summary | Signed in | Count visible projects and open issues; Admins also receive active Developer count |

## Tests, build, and lint

Run each command from the repository root:

~~~sh
npm --prefix server test
npm --prefix client test
npm --prefix client run build
npm --prefix client run lint
~~~

Verified on this branch: server tests **38 passed**; client tests **18 passed**; the production build passed. Lint exited successfully with **0 errors** and React warnings, including setState calls inside effects and a Fast Refresh export warning.

## Troubleshooting

If Vite starts on a port other than 5173, the browser may block API requests with a CORS error. The server allows the origin configured by CLIENT_ORIGIN, which defaults to http://localhost:5173. Stop old dev servers so Vite can use 5173, or set CLIENT_ORIGIN in server/.env to the exact client origin shown by Vite, then restart the server.

## CodeZero development

Code0 (CodeZero) was used throughout development, including Git and GitHub operations through the Code0 terminal. Work followed a plan, human approval, implementation, and review loop.

### AI Development Experience

CodeZero helped scaffold backend and client features quickly, write API and component tests, and trace failures such as test data leaking between cases. Human correction was still needed when feature branches diverged and an App.jsx merge conflict had to be resolved, and when test setup needed fixes such as registering the jest-dom Vitest matchers. Repository access also depended on the active sandbox permissions. Automated tests complement browser testing. I tested login, Projects, and Admin Users in the browser.

### My contribution

I reviewed and approved every plan before it ran, created the initial Admin myself through the secure bootstrap flow, tested login, Projects, and Admin Users in the browser, and resolved Git branch divergence through the CodeZero terminal. I learned how JWT authentication, role-based access control, and the last-active-Admin rule work.

### Where CodeZero helped

- **MongoDB, authentication, and RBAC:** assisted with the Mongoose connection/configuration, bcrypt/JWT registration and login, server-side Admin/Developer checks, and backend tests for those routes.
- **Initial Admin bootstrap:** helped implement the one-time bootstrap flow and tests for repeat runs and invalid credentials; test isolation was corrected so bootstrap cases start from clean collections.
- **Projects:** helped connect project creation/listing and related project APIs to the React page, with API and component test coverage.
- **Client authentication:** helped build the Login/Register session flow and authenticated requests, and resolve the App.jsx merge conflict while preserving both Projects and auth navigation.
- **Admin user management:** helped implement Admin-only user actions and tests for role/status changes, removal, Developer denial, and last-active-Admin protection.
- **Issues and dashboard metrics:** helped add the project-scoped Issues API and permission tests, the live dashboard summary endpoint, and the Issues/dashboard client pages with component tests. Fetch mocks in App flow tests were routed by URL/method after dashboard added an API request that made older one-shot mocks run out.
