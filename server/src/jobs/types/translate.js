import { createEngine } from '../../engines/engineManager.js';

export async function runTranslateJob({ repo, job, project }) {
  if (typeof repo.setSegmentDraftById !== 'function') {
    throw new Error('Repo missing setSegmentDraftById');
  }

  repo.appendJobLog(job.id, 'Starting translate job…');
  repo.setJobStatus(job.id, 'running');

  const engine = createEngine({
    type: process.env.TRANSLATION_ENGINE || 'mock',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  });

  const segs = repo.listSegments(project.id);
  const idByIdx = new Map();
  for (const s of segs) {
    idByIdx.set(s.idx, s.id);
  }
  const total = segs.length || 1;

  // Batch in chunks so progress feels live.
  const chunkSize = 25;
  for (let i = 0; i < segs.length; i += chunkSize) {
    const chunk = segs.slice(i, i + chunkSize).map(s => ({
      idx: s.idx,
      source_text: s.source_text,
    }));

    const results = await engine.translateBatch({
      segments: chunk,
      sourceLang: project.source_lang,
      targetLang: project.target_lang,
    });

    for (const r of results) {
      const segId = idByIdx.get(r.idx);

      if (!segId) {
        repo.appendJobLog(job.id, `WARN: no segment id for idx ${r.idx}`);
        continue;
      }

      repo.setSegmentDraftById({
        segId,
        draft_text: r.text,
        confidence: r.confidence,
      });
    }

    const progress = Math.floor(((i + chunk.length) / total) * 100);
    repo.setJobProgress(job.id, progress);
    repo.appendJobLog(job.id, `Translated ${i + chunk.length}/${total}`);
  }

  // ---- USAGE ACCOUNTING ----
  const usageRepo = makeUsageRepo(repo.db); // expose db from repo
  const month = currentMonth();

  if (process.env.TRANSLATION_ENGINE === 'openai') {
    const segments = repo.listSegments(project.id);

    const inputTokens = estimateTokensFromSegments(segments, 'source_text');
    const outputTokens = estimateTokensFromSegments(segments, 'draft_text');

    const cost = estimateOpenAICost({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      inputTokens,
      outputTokens,
    });

    usageRepo.addUsage({
      month,
      provider: 'openai',
      amount: cost.total_usd,
    });

    repo.appendJobLog(job.id, `Estimated OpenAI cost: $${cost.total_usd.toFixed(4)}`);
  }

  repo.setJobProgress(job.id, 100);
  repo.setJobStatus(job.id, 'done');
  repo.appendJobLog(job.id, 'Translate job done.');
}

import { estimateTokensFromSegments } from '../../usage/tokenEstimate.js';
import { estimateOpenAICost } from '../../usage/openaiCost.js';
import { makeUsageRepo } from '../../db/usageRepo.js';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}
