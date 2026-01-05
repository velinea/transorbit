import { runTranslateJob } from './types/translate.js';
import { runConsistencyJob } from './types/consistency.js';
import { createEngine } from '../engines/engineManager.js';

export function startJobRunner({ repo, pollMs = 800 }) {
  let running = false;

  const tick = async () => {
    if (running) return;
    const job = repo.fetchNextQueuedJob();
    if (!job) return;

    running = true;
    try {
      const project = repo.getProject(job.project_id);
      if (!project) throw new Error(`Project not found for job ${job.id}`);

      const engine = createEngine({
        type: process.env.TRANSLATION_ENGINE || 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      });

      if (job.type === 'translate') {
        await runTranslateJob({ repo, job, project });
      } else if (job.type === 'consistency') {
        await runConsistencyJob({ repo, job, project, engine });
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (e) {
      try {
        repo.failJob(job.id, e);
      } catch {}
    } finally {
      running = false;
    }
  };

  setInterval(() => {
    tick().catch(() => {});
  }, pollMs);

  // Run immediately once
  tick().catch(() => {});
}
