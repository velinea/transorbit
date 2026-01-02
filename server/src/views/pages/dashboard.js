export function dashboardPage({ projects }) {
  const rows = projects
    .map(
      p => `<tr>
      <td>${p.id}</td>
      <td><a href="/p/${p.id}">${escapeHtml(p.name)}</a></td>
      <td>${escapeHtml(p.source_lang)} → ${escapeHtml(p.target_lang)}</td>
      <td>${escapeHtml(p.created_at)}</td>
    </tr>`
    )
    .join('');

  return `
<section class="panel">
  <h1>Projects</h1>

  <form class="formrow" method="post" action="/api/projects">
    <input name="name" placeholder="New project name" required />
    <select name="source_lang">
      <option value="en">en</option>
      <option value="fi">fi</option>
      <option value="sv">sv</option>
    </select>
    <select name="target_lang">
      <option value="fi">fi</option>
      <option value="en">en</option>
      <option value="sv">sv</option>
    </select>
    <button type="submit">Create</button>
  </form>

  <div class="tablewrap">
    <table>
      <thead><tr><th>ID</th><th>Name</th><th>Lang</th><th>Created</th></tr></thead>
      <tbody>${
        rows || `<tr><td colspan="4" class="muted">No projects yet.</td></tr>`
      }</tbody>
    </table>
  </div>
</section>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
