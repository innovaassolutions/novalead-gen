import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../utils/logger";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function askClaude(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<ClaudeResponse> {
  const {
    maxTokens = 4096,
    temperature = 0.3,
    model = "claude-haiku-4-5-20251001",
  } = options;
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content
    .filter(block => block.type === "text")
    .map(block => (block as any).text)
    .join("\n");

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Pricing per model (per 1M tokens)
  let inputRate = 0.80;  // Haiku default
  let outputRate = 4;
  if (model.includes("sonnet")) {
    inputRate = 3;
    outputRate = 15;
  } else if (model.includes("opus")) {
    inputRate = 15;
    outputRate = 75;
  }

  const costUsd = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;

  logger.debug(`Claude (${model}): ${inputTokens} in, ${outputTokens} out, $${costUsd.toFixed(4)}`);

  return { content, inputTokens, outputTokens, costUsd };
}
