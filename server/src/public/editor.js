const CONF_THRESHOLD = 0.6;

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

document.addEventListener('click', async e => {
  const root = e.target.closest('.seg');
  if (!root) return;

  const projectId = window.__PROJECT_ID__;
  const segId = Number(root.getAttribute('data-segid'));
  const textarea = root.querySelector('textarea.final');
  const suggBox = root.querySelector('.suggestions');

  if (e.target.matches('button.save')) {
    e.preventDefault();
    const final_text = textarea.value;
    await api(`/api/projects/${projectId}/segments/${segId}`, {
      method: 'PATCH',
      body: JSON.stringify({ final_text }),
    });
    e.target.textContent = 'Saved';
    setTimeout(() => (e.target.textContent = 'Save'), 600);
  }

  if (e.target.matches('button.suggest')) {
    e.preventDefault();
    suggBox.innerHTML = `<div class="muted small">Thinking…</div>`;
    const data = await api(`/api/projects/${projectId}/segments/${segId}/suggest`, {
      method: 'POST',
      body: JSON.stringify({ n: 3 }),
    });
    const variants = data.variants || [];
    suggBox.innerHTML = variants
      .map(
        (v, i) => `
      <div class="sugg">
        <div class="srow">
          <div class="muted small">${v.reason || 'Suggestion'} • score ${
          v.score ?? ''
        }</div>
          <button class="apply" data-i="${i}">Apply</button>
        </div>
        <div>${escapeHtml(v.text)}</div>
      </div>
    `
      )
      .join('');

    // Apply handler
    suggBox.querySelectorAll('button.apply').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-i'));
        textarea.value = variants[idx].text;
        await api(`/api/projects/${projectId}/segments/${segId}`, {
          method: 'PATCH',
          body: JSON.stringify({ final_text: textarea.value }),
        });
        btn.textContent = 'Applied';
        setTimeout(() => (btn.textContent = 'Apply'), 700);
      });
    });
  }
});

function applyConfidenceFilter() {
  const onlyLow = document.getElementById('filter-low-conf')?.checked;
  const segs = document.querySelectorAll('.seg');

  segs.forEach(seg => {
    const confAttr = seg.getAttribute('data-confidence');
    const conf = confAttr === '' ? null : Number(confAttr);

    if (!onlyLow) {
      seg.style.display = '';
      return;
    }

    // Hide if confidence exists and is >= threshold
    if (conf !== null && conf >= CONF_THRESHOLD) {
      seg.style.opacity = '0.35';
    } else {
      seg.style.opacity = '';
    }
  });
}

document.addEventListener('change', e => {
  if (e.target?.id === 'filter-low-conf') {
    applyConfidenceFilter();
  }
});

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
