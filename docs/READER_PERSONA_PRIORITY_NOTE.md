# Reader Persona Priority Note

Reader Persona is planned as the second core pillar of Yuki, but it should not be implemented before the current core is stable.

## Current priority

Finish and stabilize the first core first:

1. AI setup flow.
2. Import flow.
3. Chapter/chunk storage in IndexedDB.
4. Gemini Proxy analysis.
5. Analysis progress/cancel/retry/resume UX.
6. Reader / Workspace / Rewrite Planner / Rewrite Draft.
7. Story Bible / Timeline / Relationships / World Tracker.
8. Data Health / backup / restore.
9. Final lint/build/audit.

## When to start Reader Persona

Start Reader Persona only after:

- the main import → analysis → reader/workspace/rewrite flow is usable end-to-end;
- Gemini Proxy path is reliable enough;
- Data Health backup/restore is safe;
- core UX is simple enough for normal use;
- remaining polish tasks are not blocking product use.

## Implementation ownership

Use ChatGPT for:

- product design;
- flow breakdown;
- UI copy;
- file-by-file implementation for small safe parts;
- prompt/template design;
- documentation.

Use Codex for:

- IndexedDB schema changes;
- lint/build validation;
- large-file edits;
- AI job integration;
- Gemini Proxy integration;
- Prompt Manager wiring;
- final audit and bug fixes.

## Recommended approach later

Do not implement the full Reader Persona module in one step.

Phase order:

1. Manual preference profile UI only.
2. Local IndexedDB persistence.
3. Imported-story evidence scan.
4. AI follow-up question generation.
5. Final Reader Persona JSON generation.
6. Use persona as input for new story generation.

Reader Persona should remain a preference/profile feature, not a psychological diagnosis feature.
