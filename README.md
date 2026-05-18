# Yuki

Yuki is a local-first AI workspace for story analysis and rewrite planning.

## Core workflow

1. Thiết lập AI.
2. Nhập truyện bằng file TXT.
3. Tách chương cục bộ.
4. Lưu dữ liệu vào IndexedDB.
5. Chạy phân tích bằng Gemini Proxy.
6. Đọc truyện, lập kế hoạch Rewrite, viết Rewrite Draft và kiểm tra Canon.

## Main areas

- Import
- Analysis
- Reader
- Workspace
- Rewrite Planner
- Rewrite Draft
- Story Bible
- Timeline
- Relationships
- World Tracker
- Data Health
- Prompt Manager

## Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Validate before commit:

```bash
npm.cmd run lint
npm.cmd run build
```

## Project docs

Read these first when continuing the project:

- `docs/USER_WORKING_PREFERENCES.md`
- `docs/YUKI_PROJECT_CONTINUATION_BRIEF.md`
