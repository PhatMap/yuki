# Reader Persona Feature Plan

## Goal

Reader Persona is a Yuki module for understanding a reader's story taste and turning it into a reusable creative profile.

The profile should help Yuki:

- recommend what kind of story the reader may enjoy;
- guide AI when generating a new story from scratch;
- guide rewrite decisions;
- avoid story elements the reader dislikes;
- ask follow-up questions when preference data is incomplete.

## User-facing name

Recommended UI name:

- `Reader Persona`

Vietnamese-first labels:

- `Hồ sơ gu đọc`
- `Sở thích đọc truyện`
- `Điều thích`
- `Điều không thích`
- `Câu hỏi cần bổ sung`
- `Tạo Reader Persona`
- `Dùng persona để tạo truyện mới`

Keep `Reader Persona` as the product/technical term.

## Core flow

Simple user flow:

1. User opens `Reader Persona`.
2. Yuki reads available signals from imported stories and analysis results.
3. User adds direct preferences:
   - favorite genres;
   - favorite tropes;
   - favorite character types;
   - favorite relationship dynamics;
   - preferred pacing;
   - preferred tone;
   - liked worldbuilding style;
   - disliked tropes;
   - hard no-go content;
   - examples of stories they like/dislike.
4. Yuki detects missing preference areas.
5. Yuki asks focused follow-up questions.
6. User answers or skips questions.
7. Yuki generates a Reader Persona profile.
8. Reader Persona becomes reusable input for:
   - creating a new story from scratch;
   - rewrite planning;
   - story recommendation/scoring;
   - prompt generation.

## Data sources

Reader Persona should use three signal groups.

### 1. Imported story signals

From stories already imported into Yuki:

- genres and tags where available;
- analysis result: characters, events, items, terms, locations, writing style;
- repeated tropes inferred from Story Bible / Timeline / Relationships / World Tracker;
- rewrite requests and accepted Rewrite Drafts;
- user-created story setup notes: mustKeep and mustChange.

### 2. Explicit user preferences

User-entered preferences should be treated as higher priority than inference.

Suggested fields:

- liked genres;
- disliked genres;
- liked tropes;
- disliked tropes;
- favorite character archetypes;
- disliked character archetypes;
- preferred romance level;
- preferred action level;
- preferred comedy level;
- preferred tragedy/darkness level;
- preferred worldbuilding density;
- preferred power-system complexity;
- preferred pacing;
- preferred chapter style;
- preferred ending style;
- no-go content;
- notes.

### 3. Follow-up answers

AI-generated follow-up questions should fill gaps, not ask everything again.

Question examples:

- `Bạn thích truyện tập trung vào nhân vật hay cốt truyện hơn?`
- `Bạn thích nhân vật chính mạnh sẵn, trưởng thành dần, hay bị ép vào biến cố?`
- `Bạn có thích tuyến tình cảm chậm, rõ ràng, hoặc gần như không có romance?`
- `Bạn thích worldbuilding dày, vừa phải, hay chỉ đủ dùng?`
- `Bạn ghét kiểu tình tiết nào nhất?`
- `Bạn muốn kết thúc viên mãn, bittersweet, mở, hay bi kịch?`

## Output shape

Recommended conceptual output:

```ts
interface ReaderPersonaProfile {
  id: string;
  name: string;
  summary: string;
  confidence: number;
  updatedAt: string;

  tasteAxes: {
    plotDriven: number;
    characterDriven: number;
    romancePreference: number;
    actionPreference: number;
    comedyPreference: number;
    darknessTolerance: number;
    worldbuildingDensity: number;
    powerSystemComplexity: number;
    canonStrictness: number;
    pacingPreference: 'slow' | 'balanced' | 'fast';
  };

  likes: string[];
  dislikes: string[];
  favoritePatterns: string[];
  avoidedPatterns: string[];
  favoriteCharacterTypes: string[];
  dislikedCharacterTypes: string[];
  preferredStoryShapes: string[];
  noGoContent: string[];

  evidence: ReaderPersonaEvidence[];
  missingAreas: ReaderPersonaMissingArea[];
  followUpQuestions: ReaderPersonaQuestion[];

  generationGuidance: {
    premiseGuidance: string;
    protagonistGuidance: string;
    relationshipGuidance: string;
    worldbuildingGuidance: string;
    pacingGuidance: string;
    styleGuidance: string;
    avoidGuidance: string;
  };
}
```

Important: this is a plan. Actual implementation should use existing Yuki type conventions.

## UI structure

Recommended route:

- `/reader-persona`

Recommended app navigation placement:

- Main app sidebar or dashboard CTA after AI setup.
- It should not be hidden inside a single story sidebar because it is app-wide.

Recommended page layout:

1. Header
   - Title: `Reader Persona`
   - Description: `Tạo hồ sơ gu đọc để Yuki viết truyện hợp sở thích hơn.`
2. Readiness card
   - AI setup status.
   - Number of imported stories available.
   - Number of explicit preference fields filled.
3. Preference input card
   - liked/disliked genres;
   - liked/disliked tropes;
   - no-go content;
   - notes.
4. Evidence card
   - imported stories used;
   - analysis results used;
   - rewrite signals used.
5. Follow-up questions card
   - generated missing-area questions;
   - answer/skip actions.
6. Persona output card
   - short summary;
   - taste axes;
   - likes/dislikes;
   - generation guidance;
   - CTA: `Dùng persona để tạo truyện mới`.
7. Technical details collapsed
   - provider/model/prompt/cache/job metadata.

## AI workflow

Recommended tasks:

1. `reader-persona-evidence-scan`
   - local scan of imported stories and analysis results.
   - Should not call AI unless needed.
2. `reader-persona-question-plan`
   - AI generates missing-area questions.
   - Input: existing evidence + explicit preferences.
   - Output: focused questions only.
3. `reader-persona-profile-generate`
   - AI generates the final Reader Persona.
   - Input: evidence + explicit preferences + answers.
   - Output: strict JSON profile.
4. `story-generation-from-persona`
   - later feature.
   - Input: Reader Persona + user idea + optional constraints.
   - Output: story premise/outline/chapters.

## Prompt Manager integration

Add prompt templates later:

- `reader-persona-question-plan`
- `reader-persona-profile-generate`
- `story-generation-from-persona`

Locked contract should require:

- no fake certainty;
- confidence score;
- evidence list;
- missing areas;
- clear separation between user-stated preferences and inferred preferences;
- no assumption beyond available evidence.

## Storage direction

This is an app-wide feature, not story-specific.

Recommended storage:

- IndexedDB store: `readerPersonaProfiles`
- IndexedDB store: `readerPersonaPreferenceInputs`
- IndexedDB store: `readerPersonaQuestionAnswers`

Do not store large persona evidence in localStorage.

Implementation should be versioned carefully because it requires IndexedDB schema changes.

## Safety and privacy

Reader Persona should be framed as a preference profile, not clinical diagnosis.

Use terms such as:

- `gu đọc`
- `sở thích đọc truyện`
- `mẫu truyện hợp gu`
- `thói quen thưởng thức truyện`

Avoid presenting it as medical or psychological diagnosis.

## Initial implementation phases

### Phase 1: UI and local manual profile

- Add `/reader-persona` route.
- Add sidebar/dashboard entry.
- Add manual preference form.
- Save manual fields to IndexedDB.
- No AI generation yet.

### Phase 2: Evidence scan

- Read imported stories and existing analysis results.
- Show evidence summary.
- Show missing areas locally.

### Phase 3: AI follow-up questions

- Add Prompt Manager templates.
- Generate focused questions with Gemini Proxy.
- Save answers.

### Phase 4: Persona generation

- Generate final Reader Persona JSON.
- Show confidence and evidence.
- Add export JSON.

### Phase 5: Use persona for new story generation

- Add `Create from Reader Persona` entry.
- Use persona as prompt context for premise/outline generation.
- Keep final user controls before generating content.

## Scope exclusions for first pass

Do not implement in the first pass:

- social sharing;
- account sync;
- cloud profile sync;
- recommendation marketplace;
- vector DB;
- roleplay/chatbot personality;
- psychological diagnosis.

## Recommended next step

Implement Phase 1 only:

- app-wide route `/reader-persona`;
- Vietnamese-first UI;
- manual preference form;
- IndexedDB persistence with a minimal schema addition;
- dashboard/sidebar entry;
- no AI prompt call yet.

Because Phase 1 requires IndexedDB schema change, use Codex/local full validation after the implementation.
