import "dotenv/config";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { db, agreements, aiAnalyses, revisions, users, pool } from "../packages/db/src/index.js";
import {
  analysisToEditable,
  slugify,
  type Analysis,
} from "../packages/shared/src/index.js";
import { createHash } from "node:crypto";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "change-me-123";

const demoAgreements: {
  title: string;
  countries: string[];
  sourceUrl: string;
  text: string;
  analysis: Omit<Analysis, "confidence"> & { confidence?: Analysis["confidence"] };
}[] = [
  {
    title: "DEMO Framework Agreement Metal Industry",
    countries: ["DE"],
    sourceUrl: "https://example.org/demo/metal-agreement.pdf",
    text: `${"Collective agreement for the metal and electrical industry. ".repeat(40)}
Parties: IG Metall demo region and Gesamtmetall demo employers association.
Term: 1 January 2025 to 31 December 2027. Renewal by written notice three months before expiry.
Wages: monthly gross increase of 5.2 percent from April 2025. Starting wage group EG 8.
Working time: 35 hours per week, flexible band between 06:00 and 19:00.
Overtime requires consent and is compensated at 25 percent surcharge or time off.
Annual leave: 30 working days. Additional leave for shift workers.
Grievances follow a three-step works council escalation ending in an arbitration board.`,
    analysis: {
      title: "DEMO Rahmen tarifvertrag Metallindustrie",
      title_english: "DEMO Framework Agreement Metal Industry",
      language: "German",
      country_codes: ["DE"],
      sector: "metal and electrical industry",
      parties: [
        { name: "IG Metall (demo)", kind: "union" },
        { name: "Gesamtmetall (demo)", kind: "employer_association" },
      ],
      effective_date: "2025-01-01",
      expiry_date: "2027-12-31",
      duration_notes:
        "Fixed term to end of 2027; renews only by written agreement with 3 months notice.",
      coverage_estimate: null,
      summary_english:
        "Demo framework agreement covering wages and conditions in the German metal sector. Provides a staged 5.2 percent wage increase, a 35 hour week with flexible daily hours, enhanced leave, and standard dispute resolution via an arbitration board.",
      provisions: {
        wages: "5.2 percent gross increase from April 2025; starting wage group EG 8.",
        working_hours: "35 hours per week; flexible banding 06:00-19:00.",
        overtime: "Consent required; 25 percent surcharge or compensatory time off.",
        leave: "30 working days annual leave plus additional shift-worker leave.",
        health_and_safety: null,
        job_security: null,
        grievance_procedure:
          "Three-step works council escalation concluding in a joint arbitration board.",
        union_rights: null,
        training: null,
        other_notable: [],
      },
      notable_clauses: [
        {
          topic: "Wage settlement",
          quote: "monatliche Bruttoentgelterhöhung von 5,2 Prozent",
          page: 3,
          explanation: "Headline economic term of the agreement.",
        },
      ],
    },
  },
  {
    title: "DEMO Port Workers Collective Agreement",
    countries: ["NL"],
    sourceUrl: "https://example.org/demo/port-ca.pdf",
    text: `${"Collectieve arbeidsovereenkomst havenwerkers demonstratie. ".repeat(40)}
Wages rise 4 percent in year one. Standard shift of 8 hours, max 40 per week.
Overtime paid at double time on Sundays. 25 vacation days plus ADV days.
Safety committee meets monthly. Redundancy notice period of two months after one year of service.`,
    analysis: {
      title: "DEMO Collectieve Arbeidsovereenkomst Haven",
      title_english: "DEMO Port Workers Collective Agreement",
      language: "Dutch",
      country_codes: ["NL"],
      sector: "port and logistics",
      parties: [{ name: "Havenbond (demo)", kind: "union" }],
      effective_date: "2024-04-01",
      expiry_date: "2026-03-31",
      duration_notes: "Two-year fixed term.",
      coverage_estimate: null,
      summary_english:
        "Demo Dutch port agreement with a 4 percent first-year raise, 8 hour shifts capped at 40 weekly hours, double-time Sunday overtime, 25 vacation days plus time-off credits, a monthly safety committee, and two-month redundancy notice after one year.",
      provisions: {
        wages: "4 percent increase in year one.",
        working_hours: "8 hour shifts, maximum 40 per week.",
        overtime: "Double time on Sundays.",
        leave: "25 vacation days plus ADV days.",
        health_and_safety: "Monthly safety committee meetings.",
        job_security: "Two months redundancy notice after one year of service.",
        grievance_procedure: null,
        union_rights: null,
        training: null,
        other_notable: [],
      },
      notable_clauses: [],
    },
  },
];

async function main() {
  const existingAdmin = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  let adminId = existingAdmin[0]?.id;
  if (!adminId) {
    const passwordHash = await hash(ADMIN_PASSWORD);
    const [admin] = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        passwordHash,
        displayName: "admin",
        role: "admin",
      })
      .returning();
    adminId = admin.id;
    console.log(`admin user created: ${ADMIN_EMAIL}`);
  }

  for (const demo of demoAgreements) {
    const sha256 = createHash("sha256").update(demo.text).digest("hex");
    const exists = await db.select({ id: agreements.id }).from(agreements).where(eq(agreements.sha256, sha256));
    if (exists.length > 0) continue;

    const slug = `${slugify(demo.title)}-${Math.random().toString(36).slice(2, 6)}`;
    const [agreement] = await db
      .insert(agreements)
      .values({
        slug,
        status: "processing",
        sha256,
        sourceUrl: demo.sourceUrl,
        countries: demo.countries,
        extractedText: demo.text,
        detectedLanguage: demo.analysis.language,
        submittedBy: adminId,
      })
      .returning();

    const analysis = {
      ...demo.analysis,
      confidence: demo.analysis.confidence ?? {
        identification: "high" as const,
        dates: "high" as const,
        provisions: "medium" as const,
      },
    };

    const [analysisRow] = await db
      .insert(aiAnalyses)
      .values({
        agreementId: agreement.id,
        provider: "seed",
        model: "hand-curated-demo",
        promptVersion: "v1",
        structured: analysis,
      })
      .returning();

    const [revision] = await db
      .insert(revisions)
      .values({
        agreementId: agreement.id,
        editorId: null,
        isAi: true,
        fields: analysisToEditable(analysis),
        editSummary: "Seeded demo analysis",
        status: "approved",
      })
      .returning();

    await db
      .update(agreements)
      .set({
        status: "published",
        aiAnalysisId: analysisRow.id,
        currentRevisionId: revision.id,
      })
      .where(eq(agreements.id, agreement.id));

    console.log(`seeded: /agreements/${slug}`);
  }

  console.log("seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
