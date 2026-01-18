export function projectPage({ project, status, jobs }) {
  const hasSubtitles = status.total > 0;
  const hasDraft = status.draft > 0;
  const hasFinal = status.final > 0;

  return `
<section class="panel">

  ${projectHeader(project)}

  ${statusCard(status)}

  ${actionsCard(project, { hasSubtitles, hasDraft })}

  ${jobsSection(jobs)}

</section>
`;
}

function projectHeader(project) {
  return `
<h1>${escape(project.name)}</h1>
<div class="muted">
  ${project.source_lang} → ${project.target_lang}
</div>
<hr>
`;
}

function statusCard(status) {
  return `
<div class="card project-status">
  <h3>Status</h3>

  <div>Subtitle:
    ${status.total ? `✓ uploaded (${status.total} lines)` : `✗ not uploaded`}
  </div>

  <div>Draft translation:
    ${status.draft ? `✓ ${status.draft} / ${status.total}` : `✗ not started`}
  </div>

  <div>Final text:
    ${status.final ? `✓ ${status.final} / ${status.total}` : `✗ not started`}
  </div>
</div>
`;
}

function actionsCard(project, { hasSubtitles, hasDraft }) {
  return `
<div class="card">
  <h3>Actions</h3>

  ${
    !hasSubtitles
      ? `
    <form method="post" action="/api/projects/${project.id}/upload" enctype="multipart/form-data">
      <input type="file" name="file" required>
      <button class="btn primary">Upload subtitle</button>
    </form>
  `
      : !hasDraft
        ? `
    <a class="btn" href="/p/${project.id}/edit">Open Editor</a>

    <form method="post" action="/api/projects/${project.id}/jobs" style="display:inline;">
      <input type="hidden" name="type" value="translate">
      <button class="btn primary">Translate (draft)</button>
    </form>
  `
        : `
    <a class="btn primary" href="/p/${project.id}/edit">Open Editor</a>

    <form method="post" action="/api/projects/${project.id}/jobs" style="display:inline;">
      <input type="hidden" name="type" value="consistency">
      <button class="btn">Consistency pass</button>
    </form>
  `
  }
</div>
`;
}

function jobsSection(jobs) {
  if (!jobs.length) {
    return `
<div class="card">
  <h3>Recent activity</h3>
  <div class="muted">No jobs yet.</div>
</div>
`;
  }

  const rows = jobs
    .map(
      j => `
    <div class="job-row">
      <strong>${escape(j.type)}</strong>
      <span class="badge ${j.status}">${j.status}</span>
      <span class="muted">${j.updated_at}</span>
    </div>
  `
    )
    .join('');

  return `
<div class="card">
  <h3>Recent activity</h3>
  ${rows}
  <div style="margin-top:8px;">
    <a href="/logs">View full logs →</a>
  </div>
</div>
`;
}

function escape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
