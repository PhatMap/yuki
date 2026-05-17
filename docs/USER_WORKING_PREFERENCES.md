# User Working Preferences

Read this file before continuing the Yuki project in a new chat.

## Communication style

- Use Vietnamese for normal discussion, instructions, headings, helper text, button labels, and empty states.
- Keep technical terms in English when they are exact product/runtime terms: Gemini Proxy, IndexedDB, Runtime, Prompt Manager, Data Health, JSON, API, cache, job, worker, provider, model, endpoint, prompt, template, variable, locked contract, chunk, rewrite.
- Be direct and practical. Avoid long preambles.
- State uncertainty plainly. Do not guess project facts.
- Prefer useful next actions over broad explanation.

## Preferred work style

The preferred loop is:

1. ChatGPT reads the repo/current state.
2. ChatGPT gives the next useful step.
3. ChatGPT provides exact files, exact changes, validation commands, commit message, and push instruction.
4. Codex/Copilot applies the task.
5. Codex/Copilot runs lint/build, commits, pushes, and reports the result.
6. User pastes the result back.
7. ChatGPT verifies the commit and gives the next step.

The user prefers larger safe batches instead of many tiny UI/copy steps. Split tasks only when risk is high.

## Agent effort policy

Use agent effort by risk:

- Low: exact UI/copy/CSS replacements, small file fixes.
- Medium: multi-file UI restructure or presentation-only cleanup.
- High: AI pipeline, Gemini Proxy, worker, IndexedDB, backup/restore, retry/resume, schema, and data safety.

For UI/copy tasks, ChatGPT should provide exact replacements so the agent only applies them.

## Prompt format for Codex/Copilot

Use this shape:

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
git commit -m "..."
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
