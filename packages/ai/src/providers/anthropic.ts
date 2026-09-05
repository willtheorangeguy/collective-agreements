import Anthropic from "@anthropic-ai/sdk";
import type { Analyzer, AnalyzerResult } from "../types.js";
import { buildSystemPrompt, buildUserPrompt, parseAnalysis } from "../prompt.js";

export function createAnthropicAnalyzer(model?: string): Analyzer {
  const client = new Anthropic();
  const chosen = model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  return {
    provider: "anthropic",
    model: chosen,
    async analyze(text) {
      const res = await client.messages.create({
        model: chosen,
        max_tokens: 16000,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: buildUserPrompt(text) }],
      });
      const block = res.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") {
        throw new Error("anthropic returned no text block");
      }
      const out = parseAnalysis(block.text, res);
      return {
        ...out,
        tokensIn: res.usage.input_tokens,
        tokensOut: res.usage.output_tokens,
      } satisfies AnalyzerResult;
    },
  };
}
