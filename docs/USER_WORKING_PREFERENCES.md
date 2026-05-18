# User Working Preferences

Read this file before continuing the Yuki project in a new chat.

## Communication style

- Use Vietnamese for normal discussion, instructions, headings, helper text, button labels, and empty states.
- Keep technical terms in English when they are exact product/runtime terms: Gemini Proxy, IndexedDB, Runtime, Prompt Manager, Data Health, JSON, API, cache, job, worker, provider, model, endpoint, prompt, template, variable, locked contract, chunk, rewrite.
- Be direct and practical. Avoid long preambles.
- State uncertainty plainly. Do not guess project facts.
- Prefer useful next actions over broad explanation.

## Preferred work style

The preferred loop is now:

1. ChatGPT reads the repo/current state.
2. ChatGPT directly edits and commits safe work from chat when possible.
3. ChatGPT pushes small UI/copy/CSS/docs commits directly to GitHub when the task is low risk.
4. Codex is used mainly for validation, bugfixing, and risky or large files.
5. After a few ChatGPT commits, Codex pulls latest, runs lint/build, fixes exact errors, commits, and pushes.
6. User pastes the Codex result back.
7. ChatGPT verifies the commit and continues the next useful step.

The user prefers larger safe batches instead of many tiny UI/copy steps. Split tasks only when risk is high.

## When ChatGPT should work directly

ChatGPT should work directly for:

- small UI copy cleanup;
- Vietnamese-first localization;
- simple CSS/layout density changes;
- docs updates;
- safe route/navigation label changes;
- small component simplification where behavior stays the same.

When working directly, preserve runtime behavior and avoid touching unrelated files.

## When Codex should be used

Use Codex for:

- `npm.cmd run lint` and `npm.cmd run build` validation;
- fixing lint/build/type/import errors after ChatGPT commits;
- large files that are unsafe or too long for chat tooling;
- risky logic;
- AI pipeline, Gemini Proxy, worker, IndexedDB, backup/restore, retry/resume, schema, and data safety;
- final audit after a sequence of ChatGPT commits.

Codex should not be used just to apply small copy/docs/CSS edits when ChatGPT can safely do them directly.

## Agent effort policy

Use agent effort by risk:

- Low: exact UI/copy/CSS replacements, small file fixes.
- Medium: multi-file UI restructure or presentation-only cleanup.
- High: AI pipeline, Gemini Proxy, worker, IndexedDB, backup/restore, retry/resume, schema, and data safety.

For UI/copy tasks, ChatGPT should make exact replacements directly when possible.

## Prompt format for Codex/Copilot

Use this shape when Codex is actually needed:

```txt
Task:
...

Files:
...

Exact changes:
1. In file A, replace X with Y.
2. In file B, add Z after K.

Validation:
npm.cmd run lint
npm.cmd run build

Commit and push:
git add ...
git commit -m "Concise commit message"
git push

Final response:
- commit hash
- push result
- files changed
- lint result
- build result
- known limitations

Model: GPT-5.3-Codex
Reasoning effort: Low
```

For audit/check prompts after ChatGPT commits, ask Codex to:

- pull latest master;
- run lint/build;
- fix only exact errors;
- preserve runtime behavior;
- commit only if a fix is needed;
- report results.

## Local LM Studio agent usage

The local LM Studio agent should only be used for very small edits. It works better when the target file is already open and the prompt is short.

Recommended local prompt:

```txt
Edit this file only. Do not explain.
Replace visible UI text X with Y.
Do not change logic, imports, handlers, props, state, routes, or formatting outside text.
```

Do not rely on the local model for large multi-file tasks, commit/push, lint/build verification, or risky logic changes.

## Validation and git conventions

Default validation:

```bash
npm.cmd run lint
npm.cmd run build
```

Default commit/push flow:

```bash
git add .
git commit -m "Concise commit message"
git push
```

For precise tasks, prefer exact `git add` paths.

Final agent responses should include:

- commit hash;
- push result;
- files changed;
- lint result;
- build result;
- known limitations.

If ChatGPT commits directly from GitHub tool and cannot run lint/build, say that clearly and leave the commit for the next Codex validation batch.

## UI language policy

Yuki UI should be Vietnamese-first.

Use Vietnamese for normal user-facing copy. Keep technical terms in English when precision matters.

Examples:

- Nhập truyện
- Tách chương cục bộ
- Tạo truyện trong IndexedDB
- Phân tích bằng Gemini Proxy
- Mở Data Health
- Mở Prompt Manager
- Chạy Runtime Diagnostics
- Export JSON backup

## Scope discipline

Do not touch these areas unless the task explicitly requires it:

- Supabase;
- Redis/Upstash/Cloudflare;
- auth;
- vector DB;
- Electron/Tauri/desktop;
- PDF/DOCX export;
- IndexedDB schema;
- AI provider internals;
- Gemini Proxy internals;
- worker/job/cache/retry/resume logic.

For UI-only work, preserve all runtime behavior.

## Current direction

- Gemini Proxy is the main real-AI path.
- Ollama/local models are fallback or experiment only.
- IndexedDB is the local-first source of truth.
- The project should be strong for very long stories before cloud deployment is considered.
