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
      <form method="post" action="/api/projects/${project.id}/jobs">
        <input type="hidden" name="type" value="translate" />
        <button type="submit">Translate (draft)</button>
      </form>
      <p class="muted small">Uses mock engine for now.</p>
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
