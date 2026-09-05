import OpenAI from "openai";
import type { Analyzer, AnalyzerResult } from "../types.js";
import { buildSystemPrompt, buildUserPrompt, parseAnalysis } from "../prompt.js";

export function createOpenAICompatibleAnalyzer(opts: {
  baseURL?: string;
  apiKey?: string;
  model?: string;
  providerLabel: string;
}): Analyzer {
  const client = new OpenAI({
    baseURL: opts.baseURL ?? process.env.OPENAI_BASE_URL,
    apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY ?? "not-set",
  });
  const chosen = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return {
    provider: opts.providerLabel,
    model: chosen,
    async analyze(text) {
      const res = await client.chat.completions.create({
        model: chosen,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(text) },
        ],
      });
      const content = res.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`${opts.providerLabel} returned no content`);
      }
      const out = parseAnalysis(content, res);
      return {
        ...out,
        tokensIn: res.usage?.prompt_tokens,
        tokensOut: res.usage?.completion_tokens,
      } satisfies AnalyzerResult;
    },
  };
}

export function createOpenAIAnalyzer(model?: string): Analyzer {
  return createOpenAICompatibleAnalyzer({ model, providerLabel: "openai" });
}

export function createLocalAnalyzer(model?: string): Analyzer {
  return createOpenAICompatibleAnalyzer({
    baseURL: process.env.LOCAL_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: "ollama",
    model: model ?? process.env.LOCAL_MODEL ?? "llama3.1",
    providerLabel: "local",
  });
}
