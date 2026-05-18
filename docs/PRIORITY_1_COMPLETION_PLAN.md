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

## Completed Priority 1 UX cleanup

The remaining large UX cleanup batch has been completed.

Completed issue scope:

- Timeline cleanup.
- Story Settings cleanup.
- Prompt Manager light polish.
- Data Health final copy and density pass.

Completed GitHub issues:

- #1 `Priority 1: Timeline UX cleanup`
- #2 `Priority 1: Story Settings UX cleanup`
- #3 `Priority 1: Prompt Manager light polish`
- #4 `Priority 1: Data Health final copy and density pass`

Completion commit:

- `ee73d47` — `Polish remaining Priority 1 UX`

Validation result for completion commit:

```bash
npm.cmd run lint   # pass
npm.cmd run build  # pass
```

## Current Priority 1 status

Priority 1 UX cleanup is complete at the current known state.

Next work should be an end-to-end product verification pass, not another broad copy cleanup pass.

Recommended verification checklist:

1. Fresh user first launch sees AI setup gate.
2. Settings can configure provider/key/model and test connection.
3. Import can accept TXT and split chapters.
4. Import can save story/chapter/chunk into IndexedDB.
5. Analysis starts and shows progress.
6. Analysis can cancel.
7. Analysis can retry/resume failed/incomplete batch work.
8. Reader can open chapters.
9. Workspace can open the imported story.
10. Rewrite Planner and Rewrite Draft can operate without breaking storage.
11. Story Bible, Timeline, Relationships, and World Tracker render analysis output.
12. Data Health can export backup and show validation preview.
13. `npm.cmd run lint` and `npm.cmd run build` pass after any follow-up fixes.

## Work rule

Do not implement Priority 2 or Priority 3 yet.

Priority 2 and 3 are documented so the product direction is locked, but current implementation work remains Priority 1 until the product is verified usable end-to-end.

After the end-to-end product verification pass is clean, start Reader Persona Phase 1.
