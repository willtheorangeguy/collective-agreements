import { describe, expect, it } from "vitest";
import { buildUserPrompt, parseAnalysis } from "./prompt.js";

const valid = {
  title: "Test Agreement",
  title_english: null,
  language: "English",
  country_codes: ["US"],
  sector: null,
  parties: [],
  effective_date: null,
  expiry_date: null,
  duration_notes: null,
  coverage_estimate: null,
  summary_english: "A summary.",
  provisions: {
    wages: null,
    working_hours: null,
    overtime: null,
    leave: null,
    health_and_safety: null,
    job_security: null,
    grievance_procedure: null,
    union_rights: null,
    training: null,
    other_notable: [],
  },
  notable_clauses: [],
  confidence: { identification: "high", dates: "low", provisions: "medium" },
};

describe("parseAnalysis", () => {
  it("accepts plain JSON", () => {
    const out = parseAnalysis(JSON.stringify(valid), {});
    expect(out.analysis.title).toBe("Test Agreement");
  });

  it("extracts fenced JSON", () => {
    const out = parseAnalysis("```json\n" + JSON.stringify(valid) + "\n```", {});
    expect(out.analysis.summary_english).toBe("A summary.");
  });

  it("extracts JSON embedded in prose", () => {
    const out = parseAnalysis(`Here you go:\n${JSON.stringify(valid)}\nDone.`, {});
    expect(out.analysis.language).toBe("English");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAnalysis("not json {{", {})).toThrow();
  });

  it("throws when schema validation fails", () => {
    expect(() => parseAnalysis(JSON.stringify({ ...valid, country_codes: ["usa"] }), {})).toThrow();
  });
});

describe("buildUserPrompt", () => {
  it("truncates very long documents", () => {
    const out = buildUserPrompt("x".repeat(500_000));
    expect(out).toContain("[TRUNCATED]");
    expect(out.length).toBeLessThan(400_200);
  });
});
