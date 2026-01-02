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
    timeoutMs = 60_000,
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
You are a professional subtitle translator.

Source language: ${sourceLang}
Target language: ${targetLang}

Style: ${style}

Translate the subtitle line below into ${targetLang}.
Return ${n} different alternatives.
Each alternative must be short, natural, and suitable for subtitles.

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
