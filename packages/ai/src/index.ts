import { createAnthropicAnalyzer } from "./providers/anthropic.js";
import {
  createLocalAnalyzer,
  createOpenAIAnalyzer,
} from "./providers/openai-compatible.js";
import type { Analyzer } from "./types.js";

export * from "./types.js";
export * from "./prompt.js";

export type ProviderName = "anthropic" | "openai" | "local";

export function createAnalyzer(provider?: ProviderName, model?: string): Analyzer {
  const chosen = provider ?? (process.env.AI_PROVIDER as ProviderName | undefined) ?? "anthropic";
  switch (chosen) {
    case "anthropic":
      return createAnthropicAnalyzer(model);
    case "openai":
      return createOpenAIAnalyzer(model);
    case "local":
      return createLocalAnalyzer(model);
    default:
      throw new Error(`unknown AI_PROVIDER: ${chosen}`);
  }
}
