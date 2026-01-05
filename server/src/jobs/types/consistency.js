export async function runConsistencyJob({ repo, job, project, engine }) {
  repo.appendJobLog(job.id, 'Starting consistency pass…');
  repo.setJobStatus(job.id, 'running');

  const segments = repo.listSegments(project.id);

  // Only segments that have draft text
  const items = segments
    .filter(s => s.draft_text)
    .map(s => ({
      id: s.id,
      source: s.source_text,
      draft: s.draft_text,
    }));

  if (items.length === 0) {
    repo.appendJobLog(job.id, 'No draft text found, nothing to do.');
    repo.setJobStatus(job.id, 'done');
    return;
  }

  const CHUNK = 100;
  const OVERLAP = 15;

  for (let i = 0; i < items.length; i += CHUNK - OVERLAP) {
    const slice = items.slice(i, i + CHUNK);

    let map;
    try {
      map = await engine.consistencyPass({
        items: slice,
        sourceLang: project.source_lang,
        targetLang: project.target_lang,
      });
    } catch (e) {
      repo.appendJobLog(job.id, `WARN: consistency chunk failed at ${i}: ${e.message}`);
      continue;
    }

    if (map.size > items.length) {
      repo.appendJobLog(
        job.id,
        'WARN: consistency output has more lines than input, ignoring extras'
      );
    }

    for (const s of slice) {
      const fixed = map.get(s.id);
      if (fixed && fixed !== s.draft) {
        repo.updateSegmentFinal({
          project_id: project.id,
          segId: s.id,
          final_text: fixed,
        });
      }
    }

    const progress = Math.floor((i / items.length) * 100);
    repo.setJobProgress(job.id, progress);
    repo.appendJobLog(job.id, `Processed ${progress}%`);
  }
  repo.setJobProgress(job.id, 100);
  repo.appendJobLog(job.id, 'Consistency pass completed.');
  repo.setJobStatus(job.id, 'done');
}
