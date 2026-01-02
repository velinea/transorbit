import { translateBatch } from '../../engines/mock.js';

export async function runTranslateJob({ repo, job, project }) {
  repo.appendJobLog(job.id, 'Starting translate job…');
  repo.setJobStatus(job.id, 'running');

  const segs = repo.listSegments(project.id);
  const total = segs.length || 1;

  // Batch in chunks so progress feels live.
  const chunkSize = 25;
  for (let i = 0; i < segs.length; i += chunkSize) {
    const chunk = segs.slice(i, i + chunkSize).map(s => ({
      idx: s.idx,
      source_text: s.source_text,
    }));

    const results = await translateBatch({
      segments: chunk,
      sourceLang: project.source_lang,
      targetLang: project.target_lang,
    });

    for (const r of results) {
      repo.setSegmentDraft(project.id, r.idx, r.text, r.confidence);
    }

    const progress = Math.floor(((i + chunk.length) / total) * 100);
    repo.setJobProgress(job.id, progress);
    repo.appendJobLog(job.id, `Translated ${i + chunk.length}/${total}`);
  }

  repo.setJobProgress(job.id, 100);
  repo.setJobStatus(job.id, 'done');
  repo.appendJobLog(job.id, 'Translate job done.');
}
