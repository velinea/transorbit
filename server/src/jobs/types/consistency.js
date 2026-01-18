export async function runConsistencyJob({ repo, job, project, engine }) {
  repo.appendJobLog(job.id, 'Starting consistency pass…');
  repo.setJobStatus(job.id, 'running');

  const allSegments = repo.listSegments(project.id);

  // Only segments that actually have draft text
  const items = allSegments
    .filter(s => typeof s.draft_text === 'string' && s.draft_text.trim() !== '')
    .map(s => ({
      id: s.id,
      source: s.source_text,
      draft: s.draft_text,
    }));

  if (items.length === 0) {
    repo.appendJobLog(job.id, 'No draft text found; nothing to do.');
    repo.setJobProgress(job.id, 100);
    repo.setJobStatus(job.id, 'done');
    return;
  }

  // Chunking parameters — conservative and safe
  const CHUNK_SIZE = 80;
  const OVERLAP = 15;

  let updatedCount = 0;
  let processed = 0;

  for (let i = 0; i < items.length; i += CHUNK_SIZE - OVERLAP) {
    const slice = items.slice(i, i + CHUNK_SIZE);

    let resultMap;
    try {
      resultMap = await engine.consistencyPass({
        items: slice,
        sourceLang: project.source_lang,
        targetLang: project.target_lang,
      });
    } catch (err) {
      repo.appendJobLog(
        job.id,
        `WARN: consistency chunk failed at index ${i}: ${err.message}`
      );
      processed += slice.length;
      continue;
    }

    if (!(resultMap instanceof Map)) {
      repo.appendJobLog(
        job.id,
        `WARN: consistency chunk at index ${i} returned no usable data`
      );
      processed += slice.length;
      continue;
    }

    for (const s of slice) {
      const fixed = resultMap.get(s.id);

      // HARD GUARDS — structure safety
      if (typeof fixed !== 'string' || fixed.trim() === '' || fixed === s.draft) {
        continue;
      }
      console.log(`Consistency fix for segment ${s.id}: "${s.draft}" => "${fixed}"`);
      try {
        repo.updateSegmentFinal({
          segId: s.id,
          final_text: fixed,
        });
        updatedCount++;
      } catch (e) {
        repo.appendJobLog(
          job.id,
          `WARN: failed to update segment ${s.id}: ${e.message}`
        );
      }
    }

    processed += slice.length;

    const progress = Math.min(99, Math.floor((processed / items.length) * 100));
    repo.setJobProgress(job.id, progress);
  }

  repo.appendJobLog(
    job.id,
    `Consistency pass completed. Updated ${updatedCount} lines.`
  );

  repo.setJobProgress(job.id, 100);
  repo.setJobStatus(job.id, 'done');
}
