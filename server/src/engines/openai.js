import crypto from 'node:crypto';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini'; // cheap + good for subtitles

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function hashKey(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

export class OpenAIEngine {
  constructor({
    apiKey,
    model = DEFAULT_MODEL,
    maxRetries = 3,
    timeoutMs = 180_000,
    maxBatchChars = 6000,
    maxTokens = 4096,
  }) {
    if (!apiKey) throw new Error('OpenAI API key missing');
    this.apiKey = apiKey;
    this.model = model;
    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
    this.maxBatchChars = maxBatchChars;
    this.maxTokens = maxTokens;
    this.cache = new Map(); // in-memory, short-lived
  }

  /* ------------------------------------------------------- */
  /* Draft translation (batch)                               */
  /* ------------------------------------------------------- */

  async translateBatch({ segments, sourceLang, targetLang }) {
    const batches = chunkByChars(segments, this.maxBatchChars, s => s.source_text);
    const results = [];

    for (const batch of batches) {
      const key = hashKey({ batch, sourceLang, targetLang, model: this.model });
      if (this.cache.has(key)) {
        results.push(...this.cache.get(key));
        continue;
      }

      const prompt = buildBatchPrompt(batch, sourceLang, targetLang);
      const resp = await this._call(prompt, { temperature: 0.3 });

      const parsed = parseBatchResponse(resp, batch);
      this.cache.set(key, parsed);
      results.push(...parsed);
    }
    return results;
  }

  /* ------------------------------------------------------- */
  /* Suggest variants for a single segment                   */
  /* ------------------------------------------------------- */

  async suggestVariants({
    source_text,
    sourceLang,
    targetLang,
    n = 3,
    style = 'neutral',
  }) {
    const prompt = `
You are translating movie subtitles from English to Finnish.

Your primary goal is viewer comprehension and comfortable reading speed.

Source language: ${sourceLang}
Target language: ${targetLang}

Style: ${style}

Translate the subtitle line below into ${targetLang}.
Return ${n} different alternatives.
Each alternative must be short, natural, and suitable for subtitles.

SUBTITLE STRUCTURE RULES (CRITICAL):

- Treat each subtitle line independently.
- Preserve speaker markers.
- A leading "-" indicates a new speaker.
- If a source line begins with "-", the translated line MUST begin with "-" as the first character.
- Preserve italic markers (e.g., "<i>...</i>").
- If the source line contains italic markers, the translated line MUST contain them in the same positions.
- Never remove leading punctuation used as speaker markers.

IMPORTANT CONSTRAINTS:
- Target reading speed should stay below approximately 23 characters per second.
- Finnish words and sentence structures are often longer than English; account for this.
- If a literal translation would be too long or fast to read, you MUST condense it.

ALLOWED AND ENCOURAGED:
- Paraphrase freely to preserve meaning.
- Omit filler words, repetitions, or non-essential phrases.
- Merge or simplify ideas when possible.
- Prefer natural spoken Finnish over literal accuracy.
- It is acceptable to leave out words or even short sentences if they are not necessary for understanding what is happening on screen.

DISALLOWED:
- Do not preserve original sentence structure if it harms readability.
- Do not translate word-for-word when it increases reading speed.
- Do not add explanations or expand dialogue.
- Do not merge or split subtitle lines.

PRIORITY ORDER (highest to lowest):
1. Viewer comprehension
2. Natural Finnish flow
3. Comfortable reading speed
4. Fidelity to exact wording

Think like a professional subtitle translator, not a literal translator.
Assume the viewer is already watching the scene; subtitles should support, not duplicate, the visuals.
After translating each subtitle, mentally check whether it could be read comfortably in under two seconds. If not, shorten it.

Subtitle:
"""${source_text}"""

Return JSON in the following format ONLY:
{
  "variants": [
    { "text": "...", "confidence": 0.0 },
    ...
  ]
}
`.trim();

    const resp = await this._call(prompt, { temperature: 0.6 });
    const json = safeJson(resp);

    if (!json?.variants) return [];
    return json.variants.slice(0, n).map(v => ({
      text: String(v.text),
      score: Number(v.confidence ?? 0.5),
      reason: style,
    }));
  }

  /* Consistency pass */
  async consistencyPass({ items, sourceLang, targetLang }) {
    const prompt = `
  You are translating movie subtitles from English to Finnish.

Your primary goal is viewer comprehension and comfortable reading speed.

IMPORTANT CONSTRAINTS:
- Target reading speed should stay below approximately 23 characters per second.
- Finnish words and sentence structures are often longer than English; account for this.
- If a literal translation would be too long or fast to read, you MUST condense it.

ALLOWED AND ENCOURAGED:
- Paraphrase freely to preserve meaning.
- Omit filler words, repetitions, or non-essential phrases.
- Merge or simplify ideas when possible.
- Prefer natural spoken Finnish over literal accuracy.
- It is acceptable to leave out words or even short sentences if they are not necessary for understanding what is happening on screen.

DISALLOWED:
- Do not preserve original sentence structure if it harms readability.
- Do not translate word-for-word when it increases reading speed.
- Do not add explanations or expand dialogue.

PRIORITY ORDER (highest to lowest):
1. Viewer comprehension
2. Natural Finnish flow
3. Comfortable reading speed
4. Fidelity to exact wording

Think like a professional subtitle translator, not a literal translator.

  Goal:
  - Improve consistency only.
  - Do NOT retranslate from scratch.
  - Do NOT change meaning.
  - Keep tone and style consistent across all lines.

  Fix:
  - names translated inconsistently
  - repeated phrases translated differently
  - honorifics / formality drift
  - pronouns or terms used inconsistently

  STRUCTURE RULES (MANDATORY):

  - Each subtitle line is independent.
  - Do NOT merge lines.
  - Do NOT split lines.
  - Do NOT remove lines.
  - Do NOT add new lines.
  - Return exactly one corrected text per given ID.

  FINNISH ADDRESS REGISTER (CRITICAL):

  Finnish has two ways to translate "you":
  - Informal: "sinä" (and colloquial forms like "sä")
  - Formal: "te"

  Rules:
  - Choose ONE address register for the entire movie.
  - Do NOT mix "sinä/sä" and "te".
  - If the relationship between speakers is unclear, default to informal "sinä".
  - Once the register is chosen, enforce it consistently across ALL lines.
  - Do NOT change sentence structure, timing, or merge lines.

  If any subtitle line violates the chosen address register,
  rewrite ONLY that line to match the chosen register.

  Avoid literal translation of English honorifics.

  Specifically:
  - Do NOT translate "sir" as "herra" in normal dialogue.
  - Phrases like "Yes, sir" should usually be translated simply as "Kyllä".
  - Use "herra <rank>" ONLY in clear military or hierarchical contexts
    where the rank is explicit or culturally appropriate
    (e.g. "Yes, Colonel" → "Kyllä herra eversti").

  Favor natural Finnish subtitle conventions over literal wording.

  Source language: ${sourceLang}
  Target language: ${targetLang}

  Return JSON ONLY in this format:
  {
    "lines": [
      { "id": 123, "text": "corrected subtitle line" }
    ]
  }

  Lines:
  ${items.map(i => `(${i.id}) SOURCE: ${i.source}\nDRAFT: ${i.draft}`).join('\n\n')}
  `.trim();
    if (prompt.length > 12000) {
      throw new Error('Consistency prompt too large; chunking required');
    }

    const resp = await this._call(prompt, { temperature: 0.2 });
    const json = safeJson(resp);

    if (!json || !Array.isArray(json.lines)) {
      return new Map();
    }

    const map = new Map();
    for (const l of json.lines) {
      if (
        typeof l !== 'object' ||
        typeof l.id !== 'number' ||
        typeof l.text !== 'string'
      ) {
        continue;
      }
      map.set(l.id, l.text);
    }
    return map;
  }

  /* ------------------------------------------------------- */
  /* Low-level OpenAI call                                   */
  /* ------------------------------------------------------- */

  async _call(prompt, { temperature }) {
    let attempt = 0;
    let lastErr;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), this.timeoutMs);
        console.log(
          `[OpenAI] calling model=${this.model}, prompt chars=${prompt.length}`
        );

        const res = await fetch(OPENAI_URL, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            temperature,
            max_tokens: this.maxTokens,
            messages: [
              {
                role: 'system',
                content: 'You translate subtitles accurately and concisely.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        });

        clearTimeout(to);

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`OpenAI ${res.status}: ${txt}`);
        }

        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty OpenAI response');
        return content;
        console.log('[OpenAI] response received');
      } catch (e) {
        lastErr = e;
        await sleep(500 * attempt);
      }
    }
    throw lastErr;
  }
}

/* ------------------------------------------------------- */
/* Helpers                                                 */
/* ------------------------------------------------------- */

function chunkByChars(items, limit, getText) {
  const out = [];
  let cur = [];
  let len = 0;

  for (const it of items) {
    const t = getText(it) || '';
    if (len + t.length > limit && cur.length) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(it);
    len += t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

function buildBatchPrompt(batch, src, dst) {
  return `
Translate the following subtitle lines from ${src} to ${dst}.
Keep them concise and suitable for subtitles.
Do NOT add explanations.

Return JSON ONLY in this format:
{
  "lines": [
    { "idx": <number>, "text": "...", "confidence": 0.0 }
  ]
}

Lines:
${batch.map(s => `(${s.idx}) ${s.source_text}`).join('\n')}
`.trim();
}

function parseBatchResponse(resp, batch) {
  const json = safeJson(resp);
  const lines = json?.lines ?? [];

  const map = new Map(lines.map(l => [Number(l.idx), l]));
  return batch.map(s => {
    const r = map.get(s.idx);
    return {
      idx: s.idx,
      text: r?.text ?? '',
      confidence: Number(r?.confidence ?? 0.5),
    };
  });
}

function safeJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
