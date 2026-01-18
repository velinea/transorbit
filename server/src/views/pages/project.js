const status = repo.getProjectStatus(project.id);
const hasSubtitles = status.total > 0;
const hasDraft = status.draft > 0;
const hasFinal = status.final > 0;

export function projectPage({ project, jobs }) {
  const jobsRows = jobs
    .map(
      j => `
    <tr>
      <td>${j.id}</td>
      <td>${j.type}</td>
      <td><span class="badge ${j.status}">${j.status}</span></td>
      <td>${j.progress}%</td>
      <td><a href="/p/${project.id}/edit">Editor</a></td>
    </tr>
  `
    )
    .join('');

  return `

<div class="card project-status">
  <h3>Status</h3>

  <div>
    Subtitle:
    ${hasSubtitles ? `✓ uploaded (${status.total} lines)` : `✗ not uploaded`}
  </div>

  <div>
    Draft translation:
    ${hasDraft ? `✓ ${status.draft} / ${status.total} lines` : `✗ not started`}
  </div>

  <div>
    Final text:
    ${hasFinal ? `✓ ${status.final} / ${status.total} lines` : `✗ not started`}
  </div>

  <div style="margin-top:10px;">
    ${
      !hasSubtitles
        ? `
      <em>Upload subtitles to continue.</em>
    `
        : !hasDraft
          ? `
      <a class="btn" href="/p/${project.id}/editor">Open Editor</a>
      <form method="post" action="/api/projects/${project.id}/jobs" style="display:inline;">
        <input type="hidden" name="type" value="translate">
        <button class="btn primary">Translate (draft)</button>
      </form>
    `
          : `
      <a class="btn" href="/p/${project.id}/editor">Open Editor</a>
      <form method="post" action="/api/projects/${project.id}/jobs" style="display:inline;">
        <input type="hidden" name="type" value="consistency">
        <button class="btn">Consistency pass</button>
      </form>
    `
    }
  </div>
</div>

<section class="panel">
  <h1>Project: ${escapeHtml(project.name)}</h1>

  <div class="grid2">
    <div class="card">
      <h2>Upload SRT</h2>
      <form method="post" action="/api/projects/${
        project.id
      }/upload" enctype="multipart/form-data">
        <input type="file" name="file" accept=".srt,text/plain" required />
        <button type="submit">Upload & Parse</button>
      </form>
      <p class="muted small">This replaces current segments.</p>
    </div>

    <div class="card">
      <h2>Run</h2>
      <div class="jobForms">
        <form method="post" action="/api/projects/${project.id}/jobs">
          <input type="hidden" name="type" value="translate" />
          <button type="submit">Translate (draft)</button>
        </form>
        <form method="post" action="/api/projects/${project.id}/jobs">
          <input type="hidden" name="type" value="consistency" />
          <button type="submit">Consistency pass</button>
        </form>
      </div>
      <p class="muted small"></p>
    </div>
  </div>

  <div class="card">
    <h2>Jobs</h2>
    <div id="jobs-live" class="muted small">Live updates enabled.</div>
    <div class="tablewrap">
      <table>
        <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Progress</th><th></th></tr></thead>
        <tbody id="jobs-tbody">${
          jobsRows || `<tr><td colspan="5" class="muted">No jobs yet.</td></tr>`
        }</tbody>
      </table>
    </div>
  </div>

  <script>
    window.__PROJECT_ID__ = ${Number(project.id)};
  </script>
  <script src="/public/jobs.js"></script>
</section>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
