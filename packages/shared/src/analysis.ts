import { z } from "zod";

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const PartyKind = z.enum([
  "union",
  "employer",
  "employer_association",
  "government",
  "other",
]);
export type PartyKind = z.infer<typeof PartyKind>;

export const Party = z.object({
  name: z.string().max(300),
  kind: PartyKind,
});
export type Party = z.infer<typeof Party>;

export const NotableClause = z.object({
  topic: z.string().max(200),
  quote: z.string().max(4000),
  page: z.number().int().positive().nullable(),
  explanation: z.string().max(4000),
});
export type NotableClause = z.infer<typeof NotableClause>;

const nullableText = (max: number) => z.string().max(max).nullable();

export const Provisions = z.object({
  wages: nullableText(8000),
  working_hours: nullableText(4000),
  overtime: nullableText(4000),
  leave: nullableText(4000),
  health_and_safety: nullableText(4000),
  job_security: nullableText(4000),
  grievance_procedure: nullableText(4000),
  union_rights: nullableText(4000),
  training: nullableText(4000),
  other_notable: z.array(z.string().max(1000)).max(20),
});
export type Provisions = z.infer<typeof Provisions>;

export const Analysis = z.object({
  title: z.string().min(1).max(500),
  title_english: z.string().max(500).nullable(),
  language: z.string().max(50),
  country_codes: z.array(z.string().length(2)).max(10),
  sector: nullableText(200),
  parties: z.array(Party).max(30),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  duration_notes: nullableText(2000),
  coverage_estimate: nullableText(1000),
  summary_english: z.string().min(1).max(20000),
  provisions: Provisions,
  notable_clauses: z.array(NotableClause).max(30),
  confidence: z.object({
    identification: Confidence,
    dates: Confidence,
    provisions: Confidence,
  }),
});
export type Analysis = z.infer<typeof Analysis>;
