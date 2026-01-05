export function layout({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="10">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/public/app.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand"><a href="/">TransOrbit</a></div>
    <nav class="nav">
      <a href="/">Projects</a>
      <a href="/logs">Logs</a>
      <a href="/about">About</a>
    </nav>
  </header>

  <main class="container">
    ${body}
  </main>

  <script src="/public/app.js"></script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
