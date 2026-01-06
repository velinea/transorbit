export function editorPage({ project, segments }) {
  const rows = segments
    .map(s => {
      const draft = s.draft_text ?? '';
      const fin = s.final_text ?? '';
      const conf = (s.confidence ?? '').toString();
      return `
  <div class="seg"
     data-segid="${s.id}"
     data-confidence="${s.confidence ?? ''}">
    <div class="meta">
    <div class="idx">#${s.idx}</div>
    <div class="time">${ms(s.start_ms)} → ${ms(s.end_ms)}</div>
    <div class="conf">${conf ? `conf: ${conf}` : ''}</div>
  </div>
  <div class="cols">
    <div class="col">
      <div class="label">Source</div>
      <pre class="source">${escapeHtml(s.source_text)}</pre>
    </div>
    <div class="col">
      <div class="label">Draft</div>
      <pre class="draft">${escapeHtml(draft)}</pre>
    </div>
    <div class="col">
      <div class="label">Final (editable)</div>
      <textarea class="final" rows="3" placeholder="Write final…">${escapeHtml(
        fin || draft
      )}</textarea>
      <div class="btnrow">
        <button class="save">Save</button>
        <button class="suggest">Suggest</button>
      </div>
      <div class="suggestions"></div>
    </div>
  </div>
</div>`;
    })
    .join('');

  return `
<section class="panel">
  <div class="editor-toolbar">
    <div class="toolbar">
      <a class="btn" href="/p/${project.id}">← Back</a>
      <a class="btn" href="/api/projects/${project.id}/export.srt">Export SRT</a>
      <h1>Editor: ${escapeHtml(project.name)}</h1>
    </div>
  </div>
  <div class="card" style="margin-bottom:12px;">
    <label style="display:block;">
      <input type="checkbox" id="filter-low-conf" />
      Show only low-confidence lines (&lt; 0.6)
    </label>
  </div>

  <div id="segments">
    ${rows || `<div class="muted">No segments. Upload an SRT first.</div>`}
  </div>

  <script>window.__PROJECT_ID__ = ${Number(project.id)};</script>
  <script src="/public/editor.js"></script>
</section>`;
}

function ms(n) {
  const s = Math.floor(n / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = s % 60;
  const mm = m % 60;
  const pad2 = x => String(x).padStart(2, '0');
  return `${pad2(h)}:${pad2(mm)}:${pad2(ss)}`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
