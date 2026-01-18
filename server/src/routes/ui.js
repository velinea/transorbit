import express from 'express';
import { layout } from '../views/layout.js';
import { dashboardPage } from '../views/pages/dashboard.js';
import { projectPage } from '../views/pages/project.js';
import { editorPage } from '../views/pages/editor.js';
import { makeUsageRepo } from '../db/usageRepo.js';
import { logsPage } from '../views/pages/logs.js';

export function makeUiRouter({ repo }) {
  const usageRepo = makeUsageRepo(repo.db);

  const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

  const r = express.Router();

  r.get('/', (req, res) => {
    const projects = repo.listProjects();

    const month = currentMonth();
    const usageRows = usageRepo.getUsage(month);

    // Normalize into something easy to render
    const usage = {
      openai_usd: 0,
      deepl_chars: 0,
    };

    for (const u of usageRows) {
      if (u.provider === 'openai') usage.openai_usd = u.amount;
      if (u.provider === 'deepl') usage.deepl_chars = u.amount;
    }

    res.send(
      layout({
        title: 'TransOrbit',
        body: dashboardPage({ projects, usage }),
      })
    );
  });

  r.get('/about', (req, res) => {
    res.send(
      layout({
        title: 'About',
        body: `<section class="panel"><h1>About</h1><p>TransOrbit scaffold (pure HTML/CSS/JS).</p></section>`,
      })
    );
  });

  r.get('/p/:id', (req, res) => {
    const id = Number(req.params.id);
    const project = repo.getProject(id);
    if (!project) return res.status(404).send('Not found');
    const jobs = repo.listJobs(id);
    res.send(
      layout({ title: `Project ${project.name}`, body: projectPage({ project, jobs }) })
    );
  });

  r.get('/p/:id/edit', (req, res) => {
    const id = Number(req.params.id);
    const project = repo.getProject(id);
    if (!project) return res.status(404).send('Not found');
    const segments = repo.listSegments(id);
    res.send(
      layout({
        title: `Editor ${project.name}`,
        body: editorPage({ project, segments }),
      })
    );
  });

  r.get('/logs', (req, res) => {
    // Show latest jobs across all projects
    const jobs = repo.db
      .prepare(
        `
    SELECT
      j.id,
      j.project_id,
      p.name AS project_name,
      j.type,
      j.status,
      j.progress,
      j.log_tail,
      j.updated_at
    FROM jobs j
    LEFT JOIN projects p ON p.id = j.project_id
    ORDER BY j.updated_at DESC
    LIMIT 20
  `
      )
      .all();

    res.send(
      layout({
        title: 'Logs',
        body: logsPage({ jobs }),
      })
    );
  });

  r.get('/p/:id', (req, res) => {
    const project = repo.getProject(req.params.id);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const status = repo.getProjectStatus(project.id);

    const jobs = repo.db
      .prepare(
        `
    SELECT id, type, status, progress, updated_at
    FROM jobs
    WHERE project_id = ?
    ORDER BY updated_at DESC
    LIMIT 5
  `
      )
      .all(project.id);

    res.send(
      layout({
        title: project.name,
        body: projectPage({
          project,
          status,
          jobs,
        }),
      })
    );
  });

  return r;
}
