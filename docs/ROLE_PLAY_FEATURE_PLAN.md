# Role-play Feature Plan

## Goal

Role-play is the third core pillar of Yuki.

It should let users interact with story characters, worlds, factions, scenes, or alternate scenarios after Yuki already understands the story canon.

Role-play should be canon-aware, persona-aware, and clearly separated from the source story data.

## Priority

Role-play must come after:

1. Priority 1: Nạp truyện gốc is stable.
2. Priority 2: Reader Persona is available enough to guide preference-aware interaction.

Do not implement Role-play before the import/analysis/rewrite core is product-usable.

## User-facing name

Recommended product name:

- `Role-play`

Vietnamese-first labels:

- `Nhập vai`
- `Phiên nhập vai`
- `Nhân vật`
- `Bối cảnh`
- `Giới hạn canon`
- `Mở phiên nhập vai`
- `Lưu phiên`
- `Tách khỏi canon gốc`

Keep `Role-play` as the technical/product term when needed.

## Core idea

Role-play should answer:

- User wants to talk to or act with a character.
- AI must preserve character voice and known canon.
- User can choose whether the session is strict canon, alternate canon, or free scenario.
- Session content must not overwrite source canon unless the user explicitly converts it into a rewrite/branch.

## Dependency on existing Yuki modules

Role-play should use context from:

- Story Bible: characters, items, terms, locations, writing style.
- Timeline: event order and chapter range.
- Relationships: character dynamics.
- World Tracker: power-system, locations, rules, objects.
- Rewrite branches: alternate canon where relevant.
- Reader Persona: tone, content preferences, disliked tropes, no-go content.

## Session modes

Recommended modes:

### 1. Strict Canon

- Character behavior and facts must follow Story Bible and Timeline.
- AI should refuse or redirect contradictions.
- Good for asking questions, inspecting character logic, or scene rehearsal.

### 2. Alternate Canon

- Uses selected rewrite branch or user-defined change as context.
- AI can explore consequences, but must label differences from source canon.

### 3. Free Scenario

- Uses character/world flavor but allows non-canon setup.
- Must not be written back into Story Bible automatically.

## Initial UI structure

Recommended route later:

- `/role-play`
- story-specific route later: `/stories/[storyId]/role-play`

Recommended first screen:

1. Choose story.
2. Choose character or world/scenario.
3. Choose session mode:
   - Strict Canon
   - Alternate Canon
   - Free Scenario
4. Choose Reader Persona influence:
   - Off
   - Soft guidance
   - Strong guidance
5. Start session.

Recommended chat/session UI:

- Left panel: selected story, character, canon mode, persona mode.
- Main panel: messages.
- Right/collapsed panel: canon facts used, contradictions detected, session notes.
- Bottom: user input.

## Storage direction

Role-play is mostly session data.

Recommended stores later:

- `rolePlaySessions`
- `rolePlayMessages`
- `rolePlaySessionNotes`
- `rolePlayCanonReferences`

Do not write role-play messages into Story Bible automatically.

If user wants to turn role-play into canon/rewrite:

- create a branch proposal;
- pass through Rewrite Planner;
- require user confirmation.

## Prompt Manager integration

Future prompt templates:

- `role-play-system-identity`
- `role-play-strict-canon-chat`
- `role-play-alternate-canon-chat`
- `role-play-free-scenario-chat`
- `role-play-session-summary`
- `role-play-to-rewrite-branch-proposal`

Locked contract should require:

- session mode awareness;
- explicit canon source references when possible;
- no silent canon mutation;
- clear contradiction handling;
- persona/no-go content respect.

## Safety and quality rules

Role-play should not:

- overwrite canon automatically;
- pretend uncertain canon is known;
- ignore Reader Persona no-go content;
- turn role-play into hidden memory without user confirmation;
- mix source canon and alternate scenario without labels.

Role-play should:

- cite or summarize known canon basis from Story Bible/Timeline when relevant;
- mark invented details as session-only;
- provide contradiction warnings;
- let user save, export, or discard sessions.

## Phase plan

### Phase 1: Design and static UI

- Add route shell only.
- Choose story / character / mode UI.
- No AI call yet.

### Phase 2: Session storage

- Add IndexedDB stores for sessions/messages.
- Save and reopen local sessions.

### Phase 3: Canon context builder

- Build context from Story Bible, Timeline, Relationships, World Tracker.
- Add token budget and context trimming.

### Phase 4: AI chat through Gemini Proxy

- Add Prompt Manager templates.
- Send messages through existing provider path.
- Show running/failed/success state.

### Phase 5: Persona-aware behavior

- Add Reader Persona as optional guidance.
- Respect likes/dislikes/no-go content.

### Phase 6: Convert session to rewrite branch

- Generate branch proposal.
- Send it to Rewrite Planner.
- User must approve before it affects canon/rewrite workflow.

## First implementation rule

Do not implement Role-play until Priority 1 and Reader Persona are stable enough.

For now, keep this as a documented future core.
