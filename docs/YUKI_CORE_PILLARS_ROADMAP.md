# Yuki Core Pillars Roadmap

Yuki has three product cores, in strict priority order.

## Priority 1 — Nạp truyện gốc

This is the current main core.

Goal:

- import original story text;
- split chapters/chunks locally;
- store long-story data safely in IndexedDB;
- run Gemini Proxy analysis;
- read, inspect, rewrite, and track canon;
- support Story Bible, Timeline, Relationships, World Tracker, Data Health, backup/restore.

This core must be stable before moving deeply into Persona or Role-play.

### Priority 1 success criteria

The product is usable when:

1. AI setup is clear and blocks core flows until ready.
2. Import TXT flow is simple and stable.
3. Long stories can be saved in IndexedDB.
4. Analysis can run through Gemini Proxy with progress/cancel/retry/resume.
5. Reader, Workspace, Rewrite Planner, and Rewrite Draft are usable.
6. Story Bible, Timeline, Relationships, and World Tracker help inspect canon.
7. Data Health backup/restore is safe.
8. UI is Vietnamese-first and simple.
9. lint/build pass after polish.

## Priority 2 — Reader Persona

Reader Persona is the second core.

Goal:

- understand the reader's story taste;
- combine imported-story signals with explicit user preferences;
- ask focused follow-up questions when preference data is missing;
- generate a reusable Reader Persona profile;
- use the persona when creating a new story from scratch or guiding rewrite.

Reader Persona should stay a preference/profile feature, not a psychological diagnosis feature.

### Priority 2 dependency

Do not implement this deeply until Priority 1 is stable.

Reason:

- Persona depends on imported stories, analysis results, rewrite history, and stable storage.
- It will require new IndexedDB stores, Prompt Manager templates, AI tasks, and UI routes.

Recommended phase order:

1. Manual preference profile UI.
2. IndexedDB persistence.
3. Imported-story evidence scan.
4. AI follow-up question generation.
5. Final Reader Persona JSON generation.
6. Use persona for new story generation.

See:

- `docs/READER_PERSONA_FEATURE_PLAN.md`
- `docs/READER_PERSONA_PRIORITY_NOTE.md`

## Priority 3 — Role-play

Role-play is the third core.

Goal:

- let users interact with story characters, worlds, or scenarios after canon data is available;
- use Story Bible, Timeline, Relationships, World Tracker, and Reader Persona as context;
- preserve character voice and canon constraints;
- support controlled scene simulation without breaking story data.

Role-play must not come before the analysis/rewrite core and Reader Persona are stable.

### Priority 3 dependency

Role-play depends on:

- stable story canon extraction;
- stable character/entity profiles;
- Reader Persona preferences;
- prompt safety and memory/context control;
- clear separation between canon, alternate canon, and role-play sessions.

Recommended phase order later:

1. Role-play design spec.
2. Character/session model.
3. Prompt contracts.
4. Local session storage.
5. Canon-aware chat UI.
6. Optional persona-aware role-play behavior.

## Current work rule

Do not start Priority 2 or Priority 3 implementation before Priority 1 is product-usable.

Current focus remains:

- finish core import/analysis/rewrite flow;
- finish remaining UX cleanup: Timeline, Story Settings, Prompt Manager, Data Health;
- run final audit with lint/build;
- only then start Reader Persona Phase 1.

## Ownership rule

Use ChatGPT for:

- roadmap/spec docs;
- UI copy;
- safe small UI/docs/CSS edits;
- prompt design and task breakdown.

Use Codex for:

- lint/build validation;
- IndexedDB schema changes;
- AI job integration;
- Prompt Manager wiring;
- large files;
- final audit/fixes.
