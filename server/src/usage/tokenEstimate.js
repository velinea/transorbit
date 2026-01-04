export function estimateTokensFromText(text) {
  if (!text) return 0;
  // conservative: assume 4 chars per token
  return Math.ceil(text.length / 4);
}

export function estimateTokensFromSegments(segments, field) {
  let chars = 0;
  for (const s of segments) {
    const t = s[field];
    if (t) chars += t.length;
  }
  return Math.ceil(chars / 4);
}
