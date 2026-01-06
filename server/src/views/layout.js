export function layout({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/public/app.css" />
  <link rel="icon" type="image/x-icon" href="/public/favicon.ico">
</head>
<body>
  <header class="topbar">
    <div class="brand"><img src="/public/logo.png" width="48" height="48" alt="TransOrbit Logo" />
      <a href="/">TransOrbit</a>
    </div>
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
