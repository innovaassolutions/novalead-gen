/**
 * Extract JSON from a string that may contain markdown code blocks or extra text.
 * Claude often wraps JSON in ```json ... ``` blocks.
 */
export function extractJson(text: string): any {
  const trimmed = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to extraction attempts
  }

  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try to find JSON object or array in the text
  const jsonMatch = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  throw new Error(`No valid JSON found in response: ${trimmed.substring(0, 200)}`);
}
