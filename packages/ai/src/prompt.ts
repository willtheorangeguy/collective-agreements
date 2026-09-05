import { PROMPT_VERSION, type AnalyzerResult } from "./types.js";
import { Analysis as AnalysisSchema } from "@collective/shared";
import { AnalysisError } from "./types.js";
import type { z } from "zod";

export function buildSystemPrompt(): string {
  return `You are an expert labour-relations analyst. You read collective bargaining agreements (union collective agreements) in any language and produce structured factual information about them.

Rules:
- Output ONLY a single JSON object. No markdown, no commentary.
- Base every statement strictly on the document text provided. Never invent facts.
- If a field cannot be determined from the document, use null (or an empty array for lists). Do not guess dates or numbers.
- Quote notable clauses verbatim in the original language, and explain them in English.
- If the agreement is not in English, translate the title and summary into English for title_english and summary_english. The original title goes in "title".
- "summary_english" must be a neutral, factual overview of scope, parties, term, and the most important economic and procedural terms (2-4 paragraphs).
- In provisions, describe each topic only if the document addresses it; otherwise null. Put anything significant that does not fit another provision into other_notable as short English statements.
- Set confidence per section: high if explicitly stated, medium if inferred from context, low if uncertain.

Output JSON object with exactly this shape:
{
  "title": string,
  "title_english": string | null,
  "language": string (ISO language name of the document),
  "country_codes": string[] (ISO 3166-1 alpha-2),
  "sector": string | null,
  "parties": [{"name": string, "kind": "union"|"employer"|"employer_association"|"government"|"other"}],
  "effective_date": "YYYY-MM-DD" | null,
  "expiry_date": "YYYY-MM-DD" | null,
  "duration_notes": string | null (term, renewal, notice periods),
  "coverage_estimate": string | null (number of workers covered if stated),
  "summary_english": string,
  "provisions": {
    "wages": string | null,
    "working_hours": string | null,
    "overtime": string | null,
    "leave": string | null,
    "health_and_safety": string | null,
    "job_security": string | null,
    "grievance_procedure": string | null,
    "union_rights": string | null,
    "training": string | null,
    "other_notable": string[]
  },
  "notable_clauses": [{"topic": string, "quote": string, "page": number|null, "explanation": string}],
  "confidence": {"identification": "high"|"medium"|"low", "dates": "high"|"medium"|"low", "provisions": "high"|"medium"|"low"}
}`;
}

export function buildUserPrompt(text: string): string {
  const truncated = text.length > 400_000 ? `${text.slice(0, 400_000)}\n[TRUNCATED]` : text;
  return `Analyse the following collective agreement document:\n\n<document>\n${truncated}\n</document>`;
}

export function parseAnalysis(rawText: string, raw: unknown): AnalyzerResult {
  let json = rawText.trim();
  const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) json = fence[1].trim();
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new AnalysisError("model returned no JSON object");
  }
  json = json.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new AnalysisError("invalid JSON from model", e);
  }
  const result = AnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new AnalysisError("analysis failed schema validation", result.error.flatten());
  }
  return { analysis: result.data satisfies z.infer<typeof AnalysisSchema>, raw };
}
