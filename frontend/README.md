# PostDate frontend

React and Vite client for the Express/MongoDB application.

Use Node 24 LTS. From the repository root:

```sh
npm ci
npm ci --prefix backend
npm ci --prefix frontend
npm run dev
```

Configure the backend first using `backend/.env.example`. The frontend runs on
`http://localhost:5173` and uses the API on `http://localhost:5000` during development.
Authentication uses HttpOnly cookies; no API credentials belong in frontend
environment variables or browser storage.

```sh
npm run build --prefix frontend
```

Production builds use `/api` on the same origin. Express serves the frontend
build when `NODE_ENV=production`. [SECURITY.md](../SECURITY.md) describes email
settings, HTTPS, CORS, database access, security tests and deployment limitations.

Discovery, profile editing, mutual matches, match history and password recovery now use server routes. Recovery credentials stay in memory. See ../DEPLOYMENT.md for external provider setup and live acceptance checks.
