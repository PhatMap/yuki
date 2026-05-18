# Yuki

Yuki là workspace AI local-first để nạp, phân tích, đọc và rewrite truyện dài.

## 3 core của sản phẩm

1. **Nạp truyện gốc** — core hiện tại.
2. **Reader Persona** — core thứ 2, làm sau khi core 1 ổn định.
3. **Role-play** — core thứ 3, làm sau Reader Persona.

## Luồng chính hiện tại

1. Thiết lập AI.
2. Nhập truyện bằng file TXT.
3. Tách chương cục bộ.
4. Lưu dữ liệu vào IndexedDB.
5. Chạy phân tích bằng Gemini Proxy.
6. Đọc truyện, lập kế hoạch Rewrite, viết Rewrite Draft và kiểm tra Canon.

## Khu vực chính

- Nhập truyện
- Phân tích
- Đọc truyện
- Workspace viết
- Rewrite Planner
- Rewrite Draft
- Story Bible
- Timeline
- Relationships
- World Tracker
- Data Health
- Prompt Manager

## Development

Cài dependencies:

```bash
npm install
```

Chạy development server:

```bash
npm run dev
```

Validate trước khi commit:

```bash
npm.cmd run lint
npm.cmd run build
```

## Project docs

Đọc các file này trước khi tiếp tục dự án:

- `docs/USER_WORKING_PREFERENCES.md`
- `docs/YUKI_PROJECT_CONTINUATION_BRIEF.md`
- `docs/YUKI_CORE_PILLARS_ROADMAP.md`
- `docs/PRIORITY_1_COMPLETION_PLAN.md`
