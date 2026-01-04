// USD per 1k tokens
const OPENAI_RATES = {
  'gpt-4.1-mini': {
    input: 0.00015,
    output: 0.0006,
  },
};

export function estimateOpenAICost({ model, inputTokens, outputTokens }) {
  const r = OPENAI_RATES[model];
  if (!r) throw new Error(`Unknown OpenAI model: ${model}`);

  const inCost = (inputTokens / 1000) * r.input;
  const outCost = (outputTokens / 1000) * r.output;

  return {
    input_usd: inCost,
    output_usd: outCost,
    total_usd: inCost + outCost,
  };
}
