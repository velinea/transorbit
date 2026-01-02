export async function translateBatch({ segments, sourceLang, targetLang }) {
  // Placeholder: "translate" by prefixing.
  // Replace this module with OpenAI/DeepL/etc.
  return segments.map(s => ({
    idx: s.idx,
    text: `[${sourceLang}->${targetLang}] ${s.source_text}`,
    confidence: 0.55,
  }));
}

export async function suggestVariants({ source_text, n = 3 }) {
  const base = source_text.replace(/\s+/g, ' ').trim();
  const variants = [];
  for (let i = 0; i < n; i++) {
    variants.push({
      text: `${base} (alt ${i + 1})`,
      score: 0.5 - i * 0.05,
      reason: 'Mock suggestion',
    });
  }
  return variants;
}
