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
      <label style="display:block; margin-bottom:10px;">
        <input type="checkbox" id="auto-refresh">
        Auto refresh logs (5s)
      </label>
      ${rows}
    </section>

    <script>
      const REFRESH_MS = 5000;
      const KEY = "logs-auto-refresh";

      const cb = document.getElementById("auto-refresh");
      let timer = null;

      // Restore checkbox state
      cb.checked = sessionStorage.getItem(KEY) === "1";

      function start() {
        if (timer) return;
        timer = setInterval(() => location.reload(), REFRESH_MS);
      }

      function stop() {
        if (!timer) return;
        clearInterval(timer);
        timer = null;
      }

      cb.addEventListener("change", () => {
        sessionStorage.setItem(KEY, cb.checked ? "1" : "0");
        cb.checked ? start() : stop();
      });

      // Start if enabled
      if (cb.checked) start();

    </script>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
