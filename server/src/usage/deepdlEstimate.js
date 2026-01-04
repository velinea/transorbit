export function estimateCharsFromText(text) {
  return text ? text.length : 0;
}

export function estimateCharsFromSegments(segments, field) {
  let chars = 0;
  for (const s of segments) {
    if (s[field]) chars += s[field].length;
  }
  return chars;
}
