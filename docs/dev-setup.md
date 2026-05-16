# Yuki Dev Setup

Yuki is a Next.js web app with a local-first development path. No paid service is required for current development.

## Requirements

- Node.js 20 or newer is recommended. The project uses Next.js 16.2.6, React 19, and TypeScript 5.
- npm is the package manager used by the checked-in `package-lock.json`.

## Install

```powershell
npm.cmd install
```

## Run Locally

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

The default runtime uses local browser storage and mock AI behavior. You do not need Supabase, Redis, Cloudflare, a vector database, or paid AI services to run the app.

## Optional Environment File

Copy `.env.example` to `.env.local` only when you want to override public runtime flags.

```powershell
Copy-Item .env.example .env.local
```

Defaults:

- `NEXT_PUBLIC_AI_RUNTIME=mock`
- `NEXT_PUBLIC_STORAGE_RUNTIME=indexed-db`
- `NEXT_PUBLIC_JOB_RUNTIME=local-browser`
- `NEXT_PUBLIC_AI_PROXY_ENDPOINT` unset

Do not put API keys in `NEXT_PUBLIC_*` variables. They are public browser-build values.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
```

The production build may need network access once to fetch Next font assets.
