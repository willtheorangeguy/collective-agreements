import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type {
  AgreementStatus,
  Analysis,
  EditableContent,
  JobStatus,
  RevisionStatus,
  UserRole,
} from "@collective/shared";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").$type<UserRole>().notNull().default("user"),
  acceptedEdits: integer("accepted_edits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    status: text("status").$type<AgreementStatus>().notNull().default("processing"),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    sha256: text("sha256").notNull().unique(),
    sourceUrl: text("source_url").notNull(),
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    extractedText: text("extracted_text"),
    detectedLanguage: text("detected_language"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    currentRevisionId: uuid("current_revision_id").references((): AnyPgColumn => revisions.id, {
      onDelete: "set null",
    }),
    aiAnalysisId: uuid("ai_analysis_id").references((): AnyPgColumn => aiAnalyses.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agreements_status_idx").on(t.status)],
);

export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    isAi: boolean("is_ai").notNull().default(false),
    fields: jsonb("fields").$type<EditableContent>().notNull(),
    editSummary: text("edit_summary"),
    status: text("status").$type<RevisionStatus>().notNull().default("pending"),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    index("revisions_agreement_idx").on(t.agreementId),
    index("revisions_status_idx").on(t.status),
  ],
);

export const aiAnalyses = pgTable("ai_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  agreementId: uuid("agreement_id")
    .notNull()
    .references(() => agreements.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  rawResponse: jsonb("raw_response"),
  structured: jsonb("structured").$type<Analysis>().notNull(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").$type<JobStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
