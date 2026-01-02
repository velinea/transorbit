function parseTimeToMs(t) {
  // "HH:MM:SS,mmm"
  const m = t.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!m) throw new Error(`Bad SRT timestamp: ${t}`);
  const hh = Number(m[1]),
    mm = Number(m[2]),
    ss = Number(m[3]),
    ms = Number(m[4]);
  return ((hh * 60 + mm) * 60 + ss) * 1000 + ms;
}

function msToTime(ms) {
  const clamp = Math.max(0, Math.floor(ms));
  const hh = Math.floor(clamp / 3600000);
  const rem1 = clamp - hh * 3600000;
  const mm = Math.floor(rem1 / 60000);
  const rem2 = rem1 - mm * 60000;
  const ss = Math.floor(rem2 / 1000);
  const mmm = rem2 - ss * 1000;
  const pad2 = n => String(n).padStart(2, '0');
  const pad3 = n => String(n).padStart(3, '0');
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${pad3(mmm)}`;
}

export function parseSrt(text) {
  const blocks = text
    .replace(/\r/g, '')
    .trim()
    .split(/\n\s*\n/);
  const segments = [];
  let idx = 0;

  for (const b of blocks) {
    const lines = b.split('\n').map(l => l.trimEnd());
    if (lines.length < 2) continue;

    // Some SRTs include an index line; tolerate missing index.
    let timeLineIdx = 0;
    if (/^\d+$/.test(lines[0])) timeLineIdx = 1;

    const timeLine = lines[timeLineIdx];
    const mt = timeLine.match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!mt) continue;

    const start_ms = parseTimeToMs(mt[1]);
    const end_ms = parseTimeToMs(mt[2]);

    const textLines = lines.slice(timeLineIdx + 1);
    const cueText = textLines.join('\n').trim();
    segments.push({ idx, start_ms, end_ms, text: cueText });
    idx += 1;
  }
  return segments;
}

export function writeSrt(segments) {
  const out = [];
  let n = 1;
  for (const s of segments) {
    out.push(String(n++));
    out.push(`${msToTime(s.start_ms)} --> ${msToTime(s.end_ms)}`);
    out.push((s.text ?? '').trim());
    out.push('');
  }
  return out.join('\n');
}
