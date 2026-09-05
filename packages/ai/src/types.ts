import type { Analysis } from "@collective/shared";

export const PROMPT_VERSION = "v1";

export interface AnalyzerResult {
  analysis: Analysis;
  raw: unknown;
  tokensIn?: number;
  tokensOut?: number;
}

export interface Analyzer {
  readonly provider: string;
  readonly model: string;
  analyze(text: string): Promise<AnalyzerResult>;
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}
