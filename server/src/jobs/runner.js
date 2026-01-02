import { runTranslateJob } from './types/translate.js';

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

      if (job.type === 'translate') {
        await runTranslateJob({ repo, job, project });
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
