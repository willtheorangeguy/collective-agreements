import { z } from "zod";
import { Analysis, NotableClause, Party, Provisions } from "./analysis.js";
import { isCountryCode } from "./countries.js";

export const AgreementStatus = z.enum(["processing", "published", "failed", "rejected"]);
export type AgreementStatus = z.infer<typeof AgreementStatus>;

export const UserRole = z.enum(["user", "trusted", "moderator", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const RevisionStatus = z.enum(["pending", "approved", "rejected"]);
export type RevisionStatus = z.infer<typeof RevisionStatus>;

export const JobType = z.enum(["analyze"]);
export type JobType = z.infer<typeof JobType>;
export const JobStatus = z.enum(["pending", "running", "done", "failed"]);
export type JobStatus = z.infer<typeof JobStatus>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SubmissionMeta = z.object({
  source_url: z.string().url().max(1000),
  country_codes: z
    .array(
      z
        .string()
        .length(2)
        .toUpperCase()
        .refine(isCountryCode, { message: "unknown ISO-3166-1 alpha-2 country code" }),
    )
    .min(1)
    .max(10),
  sector: z.string().max(200).optional(),
  signed_date: isoDate.optional(),
  notes: z.string().max(2000).optional(),
});
export type SubmissionMeta = z.infer<typeof SubmissionMeta>;

export const TRUSTED_AFTER_ACCEPTED_EDITS = 5;

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
}

export const EDITABLE_SECTIONS = [
  "identification",
  "summary",
  "parties",
  "provisions",
  "notable_clauses",
] as const;
export type EditableSection = (typeof EDITABLE_SECTIONS)[number];

export const EditableContent = z.object({
  title_english: z.string().min(1).max(500),
  summary_english: z.string().min(1).max(20000),
  sector: z.string().max(200).nullable(),
  effective_date: isoDate.nullable(),
  expiry_date: isoDate.nullable(),
  duration_notes: z.string().max(2000).nullable(),
  coverage_estimate: z.string().max(1000).nullable(),
  parties: z.array(Party).max(30).default([]),
  provisions: Provisions,
  notable_clauses: z.array(NotableClause).max(30),
});
export type EditableContent = z.infer<typeof EditableContent>;

export function analysisToEditable(a: Analysis): EditableContent {
  return {
    title_english: a.title_english ?? a.title,
    summary_english: a.summary_english,
    sector: a.sector,
    effective_date: a.effective_date,
    expiry_date: a.expiry_date,
    duration_notes: a.duration_notes,
    coverage_estimate: a.coverage_estimate,
    parties: a.parties,
    provisions: a.provisions,
    notable_clauses: a.notable_clauses,
  };
}
