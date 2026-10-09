# DevFlow AI

DevFlow AI is an in-progress developer workspace for the StartupMeu Software Engineer Intern assessment. The repository currently contains a React dashboard and a small Express health-check API. It is a starting point, not yet a complete MERN application.

## Current implementation

- A React and Vite dashboard with navigation, summary cards, and descriptions of the planned workspace tools.
- An Express server with `GET /` and `GET /api/health` endpoints.
- The backend loads environment variables with `dotenv` and uses `PORT` when provided; it defaults to port `5000`.
- The dashboard is currently static. Its login and workspace buttons display placeholder messages, and its summary values are hard-coded.

MongoDB, authentication, Admin/Developer role-based access control, account management, issue tracking, API testing, AI-assisted code review, team management, and audit logs are planned work. They are not implemented in this version.

## Prerequisites

- Node.js and npm versions compatible with the installed Vite version.
- A terminal and a browser.

MongoDB is not required for the current scaffold because the server does not connect to a database.

## Local development

Install the client and server dependencies from the repository root:

```sh
npm --prefix client install
npm --prefix server install
```

Run the frontend and backend in separate terminals:

```sh
npm --prefix client run dev
```

```sh
npm --prefix server run dev
```

Vite prints the frontend URL when it starts. The backend listens on port `5000` by default. Open `http://localhost:5000/` or `http://localhost:5000/api/health` to check its existing responses. Set `PORT` in the server process environment to use a different backend port; a local `server/.env` file is optional.

## Available checks

Run these from the repository root:

```sh
npm --prefix client run build
npm --prefix client run lint
npm --prefix server test
```

The client build compiles the Vite app, and the lint command runs Oxlint. The server's current `test` script is a placeholder that exits with an error; no automated server tests are configured yet.

## Security and configuration

The root `.gitignore` excludes real `.env` files, dependency folders, build output, and coverage files. Keep credentials and other secrets in local environment variables or ignored `.env` files; never commit them. No credentials or database settings are needed to run the current scaffold.

## Planned work

- MongoDB connection and application data models.
- Secure authentication and server-side Admin/Developer permissions.
- Initial Admin setup and support for at least 10 Developer accounts.
- Admin user management with last-active-Admin safeguards.
- Issue tracking, API testing, AI-assisted code review, and team management.
- Audit logs, input validation, consistent error handling, and automated tests.
