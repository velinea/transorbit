export function logsPage({ jobs }) {
  if (!jobs.length) {
    return `
<section class="panel">
  <h1>Logs</h1>
  <div class="muted">No jobs yet.</div>
</section>`;
  }

  const rows = jobs
    .map(
      j => `
    <div class="card" style="margin-bottom:12px;">
      <div class="small muted">
        <strong>#${j.id}</strong>
        • ${escapeHtml(j.project_name || 'Unknown project')}
        • ${escapeHtml(j.type)}
        • <span class="badge ${j.status}">${j.status}</span>
        • ${j.progress}%
        • ${escapeHtml(j.updated_at)}
      </div>
      <pre style="margin-top:8px; max-height:200px; overflow:auto;">
${escapeHtml(j.log_tail || '(no log output)')}
      </pre>
    </div>
  `
    )
    .join('');

  return `
<section class="panel">
  <h1>Logs</h1>
  ${rows}
</section>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
