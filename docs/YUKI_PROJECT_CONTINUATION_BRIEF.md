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
- support reader, planning, rewrite, timeline, relationships, world tracking, and Story Bible workflows.

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

## UI language policy

Yuki UI should be Vietnamese-first.

Use Vietnamese for:

- normal headings;
- buttons;
- helper text;
- empty states;
- user-facing labels.

Keep English where it is a product/runtime/technical term:

- Yuki;
- Gemini Proxy;
- IndexedDB;
- Runtime;
- Prompt Manager;
- Data Health;
- JSON;
- API;
- cache;
- job;
- worker;
- provider;
- model;
- endpoint;
- prompt;
- template;
- variable;
- locked contract;
- chunk;
- Rewrite;
- Canon;
- Story Bible.

Avoid long explanations. Simple is gold.

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
- UI explains prompt safety, variables, reset behavior, and locked contracts.

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
- Import page now focuses on the real flow: `Chọn file TXT → Tách chương → Lưu và phân tích`.

### AI setup gate

- Dashboard and core workflows are locked until AI setup is ready.
- Settings first screen follows: provider → API key → model → test connection.
- Reader remains readable before AI setup, but rewrite submit is gated.

### UI theme and layout

- Yuki Night Snow dark-first theme foundation exists.
- Theme uses dark navy surfaces, ice-blue primary, mint accents, and dark card surfaces.
- App layout was widened to better use large screens.
- Dashboard and story workspace grids now use more horizontal space on large displays.

## Recent UX cleanup commits

Recent confirmed commits after the old brief include:

- `753723a` — Localize main workflow copy and import type fix
- `f972d8a` — Improve dashboard/import/navigation workflow clarity
- `3d3d8c3` — Add guided Analysis workflow scaffold
- `9b36955` — Improve Import page structure
- `39195aa` — Remove manual raw textarea from main import UI
- `0d71480` — Add AI setup readiness gate foundation
- `385c236` — Finish AI setup blocking card/analysis gate fix
- `73cc9cc` — Add job status card and running-state signals
- `0d42088` — Simplify Settings AI setup flow
- `65df94f` — Polish app navigation route cohesion
- `10e6852` — Polish story navigation route cohesion
- `1dc684e` — Simplify import workflow UI
- `289ca2a` — Widen app page content layout
- `77582d0` — Apply wider layout stylesheet
- `b3bf0f5` — Widen dashboard story grids
- `82a2458` — Polish settings layout and copy
- `a619c4b` — Widen story content grids
- `ef503cb` — Polish wide layout density
- `d133395` — Clarify advanced story navigation labels
- `dcc17a9` — Simplify analysis page workflow UX
- `e7acec6` — Simplify workspace writing UX
- `66f575f` — Simplify reader rewrite UX
- `baebb9a` — Simplify rewrite planner UX
- `28f0911` — Simplify rewrite draft UX
- `9ba4e83` — Simplify Story Bible UX copy
- `af9fd6e` — Simplify Relationships UX copy
- `64fdead` — Simplify World Tracker UX copy
- `8fea116` — Localize AI Contract page copy
- `460c7eb` — Localize AI Proxy Test page copy
- `b55d2d4` — Localize Import Scale Test copy
- `8e97530` — Update continuation brief after UX cleanup
- `e8313e2` — Polish story tree copy
- `bc34ef7` — Polish story library layout copy
- `c823116` — Polish new story setup copy
- `1d01a2b` — Polish story card copy
- `3bbfb63` — Audit post-polish Yuki workflow
- `9832330` — Simplify AI setup blocking card

## Current known state

Completed or mostly completed UI cleanup areas:

- Dashboard
- Import
- AI setup Settings
- Story navigation
- Story library
- New story setup
- Analysis
- Workspace
- Reader
- Rewrite Planner
- Rewrite Draft
- Story Bible
- Relationships
- World Tracker
- AI Contract
- AI Proxy Test
- Import Scale Test

Still needs cleanup:

- Timeline
- Story Settings
- Prompt Manager light polish
- Data Health final copy/density pass

Important: Timeline, Story Settings, Prompt Manager, and Data Health are large enough that full-file updates through chat tooling may be blocked. Prefer Codex/local editor for these files.

## Pending validation batch

Latest validated commit:

- `3bbfb63` — `npm.cmd run lint` passed and `npm.cmd run build` passed.

Commits created after that validation and still needing one local validation:

- `9832330` — AI setup blocking card
- this brief update commit

Run:

```bash
npm.cmd run lint
npm.cmd run build
```

If errors appear, fix only those errors.

## Recommended next technical audit

After remaining localization is finished, run a post-polish technical audit:

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
- `Simplify analysis page workflow UX`
- `Simplify workspace writing UX`
- `Localize story technical pages copy`
- `Audit post-polish Yuki workflow`

Agent final response should include:

- commit hash;
- files changed;
- lint result;
- build result;
- known limitations.
