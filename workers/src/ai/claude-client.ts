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
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<ClaudeResponse> {
  const { maxTokens = 4096, temperature = 0.3 } = options;
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
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
  // Sonnet 4.5 pricing: $3/1M input, $15/1M output
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  logger.debug(`Claude: ${inputTokens} in, ${outputTokens} out, $${costUsd.toFixed(4)}`);

  return { content, inputTokens, outputTokens, costUsd };
}
