# Priority 1 Completion Plan

Priority 1 is `Nạp truyện gốc`.

This is the current product core and must be product-usable before deeper Reader Persona or Role-play implementation.

## Current target

Make the first core simple, stable, and usable end-to-end:

```txt
Thiết lập AI → Nhập truyện → Tách chương → Phân tích → Đọc / Workspace / Rewrite → Story Bible / Timeline / Relationships / World Tracker → Data Health backup
```

## Definition of product-usable

Priority 1 is product-usable when:

1. A new user knows they must set up AI first.
2. AI setup page has a clear provider → key → model → test flow.
3. Import page has one clear path for TXT upload.
4. Imported chapters save to IndexedDB.
5. Analysis starts, shows progress, can cancel, and can retry/resume.
6. Reader can read chapters cleanly.
7. Rewrite Planner can create a practical rewrite plan.
8. Rewrite Draft can save rewritten content.
9. Story Bible, Timeline, Relationships, and World Tracker can inspect analysis output.
10. Data Health can backup/restore safely.
11. UI is Vietnamese-first and not overloaded.
12. `npm.cmd run lint` and `npm.cmd run build` pass.

## Remaining cleanup before moving to Priority 2

### 1. Timeline cleanup

Goal:

- Vietnamese-first copy.
- Keep technical terms only where useful.
- Move IndexedDB/storage/debug copy into collapsed `Chi tiết kỹ thuật`.
- Keep filters and sorting behavior unchanged.

Risk:

- File is large. Prefer Codex/local editor for this file.

### 2. Story Settings cleanup

Goal:

- Make it clear this is `Cài đặt truyện`, not app/global settings.
- Keep reading/workspace settings visible.
- Move storage key details into `Chi tiết kỹ thuật`.
- Keep setup notes: original title, original author, mustKeep, mustChange.

Risk:

- File is large. Prefer Codex/local editor.

### 3. Prompt Manager light polish

Goal:

- Keep it under `Nâng cao`.
- Reduce scary/verbose helper text.
- Make variable / editable prompt / locked contract clearer.
- Do not change prompt registry logic.

Risk:

- Medium. File length can hit chat tooling limits.

### 4. Data Health final pass

Goal:

- Keep as advanced page.
- Make backup/restore actions clear.
- Reduce visible technical clutter where possible.
- Keep all warnings and safeguards.

Risk:

- High because it touches backup/restore UX and storage diagnostics.
- Use Codex/local validation.

## Validation batch

Latest known validated commit:

- `3bbfb63` passed lint/build.

Commits after that need validation:

- `9832330` — Simplify AI setup blocking card
- `c0cdc67` — Update continuation brief after story library polish
- `ef6070c` — Update working preferences for direct ChatGPT workflow
- `9fb4ae7` — Replace default README with Yuki overview
- `d1fbee1` — Add Reader Persona feature plan
- `417bed6` — Add Reader Persona priority note
- `95fdd79` — Add Yuki core pillars roadmap
- `154068c` — Add Role-play feature plan
- this Priority 1 completion plan commit

Run:

```bash
npm.cmd run lint
npm.cmd run build
```

If errors appear, fix only exact errors.

## Work rule

Do not implement Priority 2 or Priority 3 yet.

Priority 2 and 3 are documented so the product direction is locked, but current implementation work remains Priority 1 until the product is usable.
