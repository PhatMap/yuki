# Yuki Project Continuation Brief

Read this file before continuing the Yuki project in a new chat.

## Project identity

Yuki is a local-first AI story analysis workspace for long novels.

Primary goal:

- import very large story text;
- split chapters/chunks locally;
- store project data in IndexedDB;
- run AI analysis through Gemini Proxy batch jobs;
- inspect job/cache/storage state;
- backup and restore local project data;
- support reader, planning, rewrite, timeline, relationships, and story bible workflows.

The app is optimized for large stories, including stories with thousands of chapters.

## Current architecture direction

Yuki is currently local-first:

- Browser IndexedDB is the main source of truth.
- Large story/chapter/chunk/analysis/job/cache data should not be written to localStorage.
- localStorage is only for small UI preferences or temporary compatibility reads where still present.
- Gemini Proxy is the main real-AI path.
- Ollama is fallback/experiment only.
- Cloud queue, Supabase, Redis, Upstash, vector DB, auth, roleplay, Electron/Tauri, and full deployment are not the current focus.

## Active runtime model

Recommended real-AI setup:

- Provider: Gemini Proxy
- Endpoint: `/api/ai/gemini`
- Model: `gemini-2.5-flash`
- Job runtime: local worker where possible
- Storage runtime: IndexedDB

Important env direction:

- `GEMINI_API_KEY` is server-only.
- Do not expose API keys through `NEXT_PUBLIC_*`.
- Browser talks to the local app route, not directly to Gemini with a key.

## Major completed foundations

### Storage

- IndexedDB is primary for story storage.
- Large localStorage writes were removed from normal app flows.
- Legacy localStorage story fallback was removed from normal app pages.
- Data Health can still inspect/migrate/clear legacy-related data where implemented.

### Prompt Manager

- Global prompt templates are stored in IndexedDB.
- Prompt Manager exists at `/prompt-manager`.
- Prompt templates include locked contracts and editable prompt sections.
- UI now explains prompt safety, variables, reset behavior, and locked contracts.

### Local AI job system

- Local AI job queue and runner exist.
- Job persistence exists in IndexedDB.
- Job task persistence exists in IndexedDB.
- AI job cache store exists in IndexedDB.
- Cache supports derived AI task output reuse.
- Data Health can inspect AI jobs/tasks/cache entries.

### Analysis dashboard

- Story Analysis dashboard is wired into local job orchestration.
- local-browser and local-worker paths exist.
- Gemini Proxy batch analysis jobs are supported.
- Batch controls exist: batch size, concurrency, request delay.
- Safe/Fast Gemini batch profiles exist.
- Analysis jobs can be cancelled.
- Worker cancellation is graceful.
- Partial failed batch results are not saved.
- Retry/resume for failed/incomplete batch tasks exists.
- Resume should retry only failed/incomplete work and reuse valid cache hits.

### Gemini Proxy

- Server route exists: `/api/ai/gemini`.
- Browser provider routes requests through the app proxy.
- Gemini API key is server-side.
- Adapter profiles exist for Google Generative Language and OpenAI-compatible mode.
- Key pool and retry/failover support exist server-side.
- Model discovery route exists.
- Runtime Diagnostics include Gemini Proxy route/model/key-pool/retry checks.

### Diagnostics and storage safety

- Runtime diagnostics panel exists.
- Worker smoke diagnostics exist.
- Storage quota diagnostics exist.
- Persistent storage request support exists.
- Diagnostics JSON export exists.

### Backup and restore

- Per-story backup export exists in Data Health.
- Story backup validation preview exists.
- Guarded story backup restore exists.
- App backup export exists in Settings.
- App backup validation preview exists.
- Guarded app backup restore exists.
- App backup prompt restore was fixed.

### Import flow

- Import page uses local import worker.
- Import processing is cancelable.
- Import page saves story/chapter/chunk data to IndexedDB.
- Import page has UX guidance for large story import.

### UI theme

- Yuki Night Snow dark-first theme foundation exists.
- Theme uses dark navy surfaces, ice-blue primary, mint accents, and dark card surfaces.
- Contrast polish was applied.
- Shared UI surfaces were polished.

### UI/UX polish completed

Completed areas:

- Settings UX for Gemini Core workflow.
- Story Analysis Dashboard UX.
- Import Page UX.
- Story Data Health UX.
- Home Dashboard and Stories List UX.
- Shared StoryCard actions.
- Reader UX.
- Prompt Manager UX.
- Story Workspace UX.
- Shared UI surface polish.
- App metadata/public asset guidance.
- UI copy cleanup pass.

## Recent confirmed commits

Recent relevant commits include:

- `2931182` — Restructure settings UX for Gemini core
- `bf8da7b` — Polish story analysis dashboard UX
- `25ce5f3` — Polish import page UX
- `7b2b072` — Polish story data health UX
- `8906322` — Polish home and stories UX
- `6cd34c9` — Polish shared story card actions
- `4d55396` — Polish remaining Yuki UI workflow
- `01a68cd` — Clean up Yuki UI copy
- `e0b8446` — Add user working preferences brief

## Current known issue / immediate next work

The user wants UI copy to be Vietnamese-first.

A previous cleanup pass converted many visible UI labels to English. The desired policy is:

- normal UI copy should be Vietnamese;
- technical terms can remain English.

Example desired copy:

- Nhập truyện
- Tách chương cục bộ
- Tạo truyện trong IndexedDB
- Đang tải chương từ IndexedDB
- Chưa có chương để đọc
- Phân tích bằng Gemini Proxy
- Mở Data Health
- Mở Prompt Manager

Because the local LM Studio Qwen 7B agent is weak on large multi-file edits, localization should be handled in small file groups or by Codex/Copilot.

Recommended immediate task:

1. Localize import page visible copy.
2. Localize reader visible copy.
3. Localize analysis/workspace/navigation copy.
4. Localize home/stories/dashboard copy.
5. Light pass on Prompt Manager/Settings/Data Health copy.

Keep technical terms in English.

## Important route expectations

Shared StoryCard currently exposes links to:

- `/stories/[storyId]/workspace`
- `/stories/[storyId]/reader`
- `/stories/[storyId]/analysis`
- `/stories/[storyId]/data-health`

After UI polish, a technical audit should verify these route files exist and links are correct.

## Recommended next technical audit

After localization is fixed, run a post-polish technical audit:

- verify routes/links;
- verify Prompt Manager JSX layout;
- verify Reader and Workspace rendering;
- verify metadata icon references are safe;
- verify no unused imports;
- run lint/build.

This should be a bugfix-only audit, not a new feature.

## Validation commands

Always run:

```bash
npm.cmd run lint
npm.cmd run build
```

## Commit convention

Use concise commit messages such as:

- `Localize import page UI copy`
- `Localize story workflow UI copy`
- `Localize home and story library UI copy`
- `Audit post-polish Yuki workflow`

Agent final response should include:

- commit hash;
- push result;
- files changed;
- lint result;
- build result;
- known limitations.
