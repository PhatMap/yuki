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
- `src/lib/ai/jobs/progress.ts` calculates deterministic task counts and percent complete.
- `src/lib/ai/jobs/local/local-job-queue.ts` provides a browser-safe in-memory queue for local execution.
- `src/lib/ai/jobs/local/local-job-runner.ts` runs queued tasks with bounded concurrency, progress callbacks, cancellation, retries, and mock execution.
- `src/lib/ai/jobs/local/mock-job-task-handler.ts` returns predictable mock task results without calling any provider.
- `src/lib/ai/jobs/local/indexed-db-job-store.ts` persists local job and task state through the shared `AiJobStore` interface.
- `src/lib/ai/jobs/local/indexed-db-job-cache-store.ts` persists reusable task output by cache key through `AiJobCacheStore`.

This keeps React screens focused on UI while job planning, batching, progress, retries, and caching can move behind adapters.

## Local Job Runner

The local runner is the first execution foundation for large-story processing. It accepts a planned job and its tasks, queues them in memory, claims runnable tasks, marks tasks running, completes or retries failures, and reports progress through a callback. It can also skip tasks when a caller supplies a cache-check callback.

The queue is intentionally in-memory only. It owns immediate execution state such as which task is claimed next and which tasks are currently running. It does not use `localStorage` and it does not try to be durable.

Durable local job state lives in IndexedDB through `IndexedDbJobStore`. The local runner can accept this store optionally and persist job start, task running/completed/failed state, retry metadata, progress, and final job status. If no store is provided, the runner keeps the same in-memory behavior.

This is not a cloud queue. There is no Supabase table, Redis list, Cloudflare Queue, worker deployment, auth layer, or paid-service requirement. The local implementation exercises the same concepts future adapters need: task status transitions, dependency checks, retries, cache skips, bounded concurrency, cancellation, and progress calculation.

Future cloud job stores, such as Supabase-backed metadata tables, can implement the same `AiJobStore` interface. That keeps resume/inspection persistence separate from the execution queue, whether tasks run in the browser, a local worker, or a later cloud worker.

## Local Cache Store

Cache keys are derived from content fingerprint + prompt fingerprint + provider/model identity. For story analysis this is produced by `createAiJobCacheKey`, which includes story scope plus a stable digest built from content hash and prompt version context.

`IndexedDbJobCacheStore` stores derived task outputs in IndexedDB so repeated local analysis work can be skipped when a matching cache key already exists. Cache entries include hit metadata (`lastHitAt`, `hitCount`) and optional story/job/task/provider/prompt fields for inspection and cleanup.

The cache is not the source of truth for stories or job state. It is reusable derived output that can be regenerated from canonical story text and prompts. Future Redis/Upstash or other cloud cache adapters can implement the same `AiJobCacheStore` interface.

## Story Analysis Dashboard Integration

The Story Analysis Dashboard now exercises the local job system when `NEXT_PUBLIC_JOB_RUNTIME=local-browser`. Before the existing `runAiPipeline` call, it plans and runs local story-analysis tasks through `runLocalAiJob` with IndexedDB job and cache adapters.

Current local task outputs are used for progress tracking and cache hit/skip validation. The saved `StoryAnalysisResult` contract is unchanged in this step: final analysis data still comes from the existing pipeline providers (mock or Gemini proxy) and is saved through the existing IndexedDB flow.

Later steps can replace the mock local task output with real per-batch analysis aggregation while keeping the same job and cache interfaces.

## Local Worker Runtime

`NEXT_PUBLIC_JOB_RUNTIME=local-browser` runs the local job planner, runner, IndexedDB job store, and IndexedDB cache store in the main browser context.

`NEXT_PUBLIC_JOB_RUNTIME=local-worker` runs the same local story-analysis orchestration through a Web Worker. This keeps heavy local planning/running work off the UI thread while still using free local-first infrastructure.

Implementation note: local worker orchestration must not depend on `window`. Shared local job code should check `globalThis.indexedDB` so it can run in both the main browser thread and Web Worker runtime.

Both local runtimes still preserve the current product contract: local job outputs are used for progress/cache validation, while the final saved `StoryAnalysisResult` still comes from the existing `runAiPipeline` flow.

`cloud-queue` remains future work for a later Supabase/Redis/Cloudflare adapter.

## UI Motion Policy

Yuki can use small animation patterns for state feedback, especially around job progress, runtime status, and long-running local processing.

Animation must stay lightweight:
- no large animation dependency by default
- no blocking core product flow
- respect `prefers-reduced-motion`
- avoid decorative animation on dense reader text
- keep analysis/rewrite progress readable before visual effects

ReactBits-style components can be adapted selectively, but copied components must be reviewed for dependencies, accessibility, bundle impact, and license/source compatibility before being added to the project.

## Batch-Aware Local Mock Analysis

Local story-analysis jobs now produce batch-level mock analysis outputs instead of generic echo-only task results. Each local task can create a partial `StoryAnalysisResult`, and the local orchestration layer can aggregate those partial results into one story-level analysis result.

When the active AI provider is `mock`, the dashboard can use this local aggregated result after the local job completes. This removes the old limitation where mock analysis only represented the first small sample of chapters.

Real provider behavior is unchanged: Gemini proxy and future providers still use the existing `runAiPipeline` contract until a real batch aggregation provider is implemented.

## Local Aggregated Result Handoff

The Story Analysis Dashboard keeps the local aggregated mock result in component state for display/debug visibility, but the active run must pass the freshly produced aggregated result through a local variable inside `handleStartAnalysis`.

This avoids relying on React state updates synchronously inside the same async analysis run.

## Local Import Worker

Large story import processing runs through a local Web Worker. Chapter detection, chunking, and initial analysis status creation are kept off the main UI thread so 3000+ chapter imports do not block the page as heavily.

The worker does not save data directly. It returns chapters, chunks, and initial analysis status to the import page, and the page keeps the existing IndexedDB save flow.

## Cancelable Local Import

The import page uses `AbortController` when running the local import worker. Long-running detect/chunk operations can be cancelled from the UI, and the worker client terminates the worker during cleanup.

This keeps large local imports safer for 3000+ chapter stories without adding backend infrastructure.

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
