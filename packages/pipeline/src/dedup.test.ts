import { describe, expect, it } from "vitest";
import { isNearDuplicate, jaccard, shingles } from "./dedup.js";

describe("shingles", () => {
  it("produces word n-grams", () => {
    const s = shingles("one two three four five six seven eight nine");
    expect(s.size).toBe(2);
    expect(s.has("one two three four five six seven eight")).toBe(true);
  });

  it("is empty for short text", () => {
    expect(shingles("too short").size).toBe(0);
  });
});

describe("jaccard", () => {
  it("identical sets score 1", () => {
    const a = shingles("alpha beta gamma delta epsilon zeta eta theta");
    expect(jaccard(a, a)).toBe(1);
  });

  it("disjoint sets score 0", () => {
    expect(
      jaccard(
        shingles("alpha beta gamma delta epsilon zeta eta theta"),
        shingles("one two three four five six seven eight"),
      ),
    ).toBe(0);
  });

  it("empty set scores 0", () => {
    expect(jaccard(new Set(), shingles("alpha beta gamma delta epsilon"))).toBe(0);
  });
});

describe("isNearDuplicate", () => {
  const base =
    "Article 5 Wages. Employees shall receive a monthly gross salary of 3200 euros. " +
    "Annual leave shall be 30 working days per calendar year. Overtime compensated at 150 percent.";

  it("detects near-identical text", () => {
    expect(isNearDuplicate(base, `${base} `)).toBe(true);
  });

  it("rejects different text", () => {
    expect(
      isNearDuplicate(base, "Completely unrelated contract text about shipping and ports."),
    ).toBe(false);
  });
});
