# Yuki Architecture

Yuki stays a web app for now. The architecture goal is portable local-first processing that runs well on a local machine and can later connect to free-tier services through adapters.

## Local-First Storage

Current story data, imported chapters, analysis results, branches, rewrite proposals, rewrite drafts, and Prompt Manager templates live in IndexedDB. IndexedDB is used because large story data does not belong in `localStorage`, and it works offline without a backend account.

`localStorage` should remain limited to small preferences when needed. Large story text, prompt templates, job records, and AI outputs should use IndexedDB or a future store adapter.

## AI Job Foundation

Large stories can reach 3000+ chapters. Direct frontend loops inside React components will become hard to pause, retry, cache, or move to background workers. The job foundation separates planning from execution:

- `src/lib/ai/jobs/types.ts` defines portable jobs, tasks, statuses, retry metadata, progress, provider targets, runtime targets, and cache keys.
- `src/lib/ai/jobs/adapters.ts` defines implementation-neutral store, queue, cache, and runner interfaces.
- `src/lib/ai/jobs/cache-key.ts` creates deterministic browser-safe cache keys.
- `src/lib/ai/jobs/story-analysis-job-planner.ts` creates pure story-analysis job plans without calling AI or writing storage.

This keeps React screens focused on UI while job planning, batching, progress, retries, and caching can move behind adapters.

## Adapter Direction

No cloud adapter is implemented in this step. The interfaces are shaped so future free-tier integrations can plug in without rewriting product flows:

- IndexedDB local job store for offline job records and task state.
- In-memory local queue for immediate browser execution.
- Supabase job store for optional shared job metadata later.
- Cloudflare Queue for durable async task dispatch later.
- Redis/Upstash cache or lock store for optional cache coordination later.
- Worker or Edge Function runner for moving provider calls away from the browser later.

## Runtime Configuration

`src/lib/runtime/runtime-config.ts` exposes safe public flags:

- `NEXT_PUBLIC_AI_RUNTIME`
- `NEXT_PUBLIC_STORAGE_RUNTIME`
- `NEXT_PUBLIC_JOB_RUNTIME`
- `NEXT_PUBLIC_AI_PROXY_ENDPOINT`

All flags have local defaults. A fresh clone should run with no environment variables.

`NEXT_PUBLIC_AI_PROXY_ENDPOINT` is only a public endpoint value. API keys must stay server-side or inside a private proxy when a real provider is connected.

## Current Constraints

- No paid service is required.
- No Supabase, Redis, Cloudflare Worker, vector database, auth, desktop shell, or new backend dependency is active.
- Existing IndexedDB behavior is preserved.
- AI calls remain behind existing provider/proxy boundaries.
- Job planning is pure and testable; execution adapters can be added later.
