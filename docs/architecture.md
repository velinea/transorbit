# TransOrbit architecture

## Core goals

- Standalone web tool (like FFOrbit): Node/Express + vanilla HTML/CSS, zero heavy frontend framework required.

- Pluggable engines: OpenAI / DeepL / LibreTranslate / local LLM later.

- User-in-the-loop where AI isn’t confident: alternatives, per-line re-asks, style controls.

- Multi-pass pipeline: draft → polish → consistency → style/persona → QC/scoring.

- Unraid-friendly: single container (Node) + optional worker (Python), no external DB required (SQLite works great).

## 1) Repository layout (monorepo-ish but simple)

```
transorbit/
  server/
    src/
      app.js
      routes/
        ui.js
        api.jobs.js
        api.projects.js
        api.files.js
        api.engines.js
      controllers/
      services/
        jobs/
          jobRunner.js
          queue.js
          jobTypes/
            translate.js
            polish.js
            consistency.js
            persona.js
            qc.js
            export.js
        engines/
          engineManager.js
          openaiEngine.js
          deeplEngine.js
          libreEngine.js
          mockEngine.js
        subtitles/
          parseSrt.js
          writeSrt.js
          normalize.js
          segmenter.js
          diff.js
        scoring/
          confidence.js
          readability.js
          heuristics.js
        storage/
          db.js          (SQLite)
          projectsRepo.js
          jobsRepo.js
          memoryRepo.js  (translation memory + glossary)
        workers/
          pythonBridge.js (optional)
      views/             (server-rendered HTML)
        layout.html
        dashboard.html
        project.html
        editor.html
        settings.html
      public/
        css/
        js/
          editor.js
          jobs.js
          api.js
          diffview.js
      config/
        defaults.json
    package.json

  worker-python/         (optional)
    transorbit_worker/
      __init__.py
      api.py             (FastAPI or simple Flask)
      align.py           (future: speech alignment)
      langdetect.py      (optional)
      metrics.py         (optional)
    requirements.txt

  docker/
    Dockerfile
    docker-compose.yml
```

Key idea: Node owns the product. Python is optional add-on for math-y / NLP-y helpers, never the core.

## 2) Data model (SQLite, minimal + durable)

#### Projects

- id
- name
- source_lang, target_lang
- created_at
- settings_json (engine choice, passes enabled, style, limits)

#### Files

- id, project_id
- type: source_subtitle | translated_subtitle | reference_subtitle
- path, hash
- meta_json (fps, frame-based offsets if you add later)

#### Segments (subtitle lines)

- id, project_id, idx
- start_ms, end_ms
- source_text
- draft_text
- final_text
- speaker (optional)
- confidence (0–1)
- flags_json (too_long, ambiguous, profanity, name_inconsistent…)

#### Suggestions (user-in-loop)

- id, segment_id
- variant_text
- engine, prompt_style
- score, reason (short)
- created_at

#### Translation memory + glossary

- tm_source, tm_target, context_tags, usage_count
- glossary_term, glossary_translation, notes

#### Jobs

- id, project_id
- type: translate/polish/consistency/persona/qc/export
- status: queued/running/done/failed/cancelled
- progress (0–100)
- log_tail
- created_at, updated_at

SQLite gives you:

- persistence across container restarts
- easy “single file volume” on Unraid

## 3) Translation pipeline (passes)

Think of translation as composable passes that read/write segment fields.

#### Pass 1 — Draft translation

- Input: source_text
- Output: draft_text
- Engine: cheap & fast by default.

#### Pass 2 — Polish

- Input: draft_text
- Output: improved draft_text or final_text (your call)
- Fix grammar, idioms, punctuation, naturalness.

#### Pass 3 — Consistency pass

- Enforce glossary / translation memory
- Detect inconsistent names (“John” vs “Jon”)
- Normalize honorifics, recurring phrases, tone

#### Pass 4 — Persona / speaker style (optional)

- Apply speaker-based style transforms
- If no speaker labels exist:
  - allow “scene style presets” (formal/casual/gritty)
  - optionally allow user to tag blocks of lines as “Character A/B”

#### Pass 5 — QC + confidence scoring

Produces:

- per-line confidence
- flags (ambiguous, too long, missing context, potential mistranslation)
- triggers: “needs review”, “offer alternatives”

#### Export

- Write SRT/VTT/ASS
- Optional: “reading speed” reflow, line breaks

## 4) Engine abstraction (how you plug OpenAI/DeepL/etc.)

**Common engine interface**

```
// engines/EngineBase.js (conceptually)
translateSegments({ segments, sourceLang, targetLang, options }) => {
  // returns [{ idx, text, confidence?, meta? }]
}
suggestVariants({ segment, n, styleHints }) => {
  // returns [{ text, score?, reason? }]
}
```

**EngineManager**

- Chooses engine based on project settings
- Handles rate limits + retries
- Caches recent calls (hash-based)
- Logs token/cost estimates (where possible)

**Why this matters**

It lets you mix:

- Draft: DeepL (cheap, solid)
- Polish/QC: OpenAI (smart)
- Offline mode: LibreTranslate / local model later

## 5) Job queue + real-time UI updates (the “Node is better” part)

**Queue options**

- BullMQ + Redis (robust, heavier)
- SQLite-backed queue (simpler, enough for Unraid)

Given your “simple tools” vibe, I’d do:

- SQLite jobs table
- single worker loop
- concurrency = 1..N configurable
- progress events via SSE (Server-Sent Events)

**SSE endpoints**

- GET /api/jobs/stream → pushes job updates to browser
- Browser updates progress bars instantly, no websocket complexity.

## 6) API endpoints (clean + predictable)

**Projects**

- POST /api/projects create
- GET /api/projects list
- GET /api/projects/:id details
- PATCH /api/projects/:id/settings update options

**Files**

- POST /api/projects/:id/files upload subtitle
- GET /api/projects/:id/files/:fileId/download
- POST /api/projects/:id/import (paste SRT text)

**Segments + editor actions**

- GET /api/projects/:id/segments?view=source|draft|final
- PATCH /api/projects/:id/segments/:segId edit final text
- POST /api/projects/:id/segments/:segId/suggest?n=3&style=literal
- POST /api/projects/:id/segments/bulk-apply accept suggestion set

**Jobs**

- POST /api/projects/:id/jobs { type: "translate", ... }
- GET /api/projects/:id/jobs
- POST /api/jobs/:jobId/cancel
- GET /api/jobs/stream (SSE)

**Engines**

- GET /api/engines available + configured
- PATCH /api/engines/:name set keys/limits/test

## 7) UI screens (vanilla HTML + tiny JS)

#### A) Dashboard

- Recent projects
- “New translation project”
- Engine status (keys OK / missing)
- Recent jobs list

#### B) Project page

- Upload SRT / paste text
- Choose languages + engine preset
- Toggle passes (draft/polish/consistency/persona/qc)
- Start pipeline
- Live progress (SSE)

#### C) Editor (the heart)

Layout idea:

- Left: source text + timestamps
- Right: final text (editable)
- Bottom/right: suggestions panel
- Top: filters “show: low confidence / flagged / long lines / glossary hits”
- Quick actions per line:
  - Accept suggestion 1/2/3
  - “Retry (more literal / more natural / shorter / funnier / formal)”
  - “Explain meaning” (optional)
- Diff view toggle: show changes vs source/draft

#### D) Glossary / Translation memory

- Add terms
- Import CSV
- Show “most used”
- “Apply consistency pass again”

#### E) Settings

- Engine API keys
- Rate limits
- Cost guardrails (max tokens/job, max $ estimate/job)
- Default reading speed constraints

## 8) Python worker (optional, but ready)

Use Python only when it genuinely helps:

- language detection heuristics
- advanced scoring metrics
- future: audio alignment / forced timing analysis
- future: embeddings-based translation memory search

**Bridge design**

Node calls Python via HTTP:

- POST http://worker:8000/metrics with segments → returns scoring
- POST http://worker:8000/langdetect → returns probabilities
- (later) POST /align for audio/sub timing hints

If Python worker is missing, Node falls back to JS heuristics.

## 9) Docker / Unraid deployment

**Container design**

- transorbit (Node, includes UI + API + job runner)
- optional transorbit-worker (Python helpers)

Volumes:

- /config (SQLite db + settings)
- /data (uploaded subtitles, exports)

Network:

- normal bridge, expose one port.

This matches your existing Orbit tool style.

## 10) Suggested MVP slice (so you get something working fast)

If you build in this order, you’ll have a killer demo quickly:

1. Project create + SRT upload + parse into segments
2. Draft translation pass (one engine)
3. Editor with “final_text” editing
4. QC/confidence heuristic (even basic) + “low confidence” filter
5. Suggestions per line (n=3) + accept buttons
6. Export SRT

Then add:

- glossary + consistency pass
- persona styling
- multi-engine mix & match
