import { describe, expect, it } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Collective Agreement 2024!")).toBe("collective-agreement-2024");
  });

  it("strips accents", () => {
    expect(slugify("Tarifvertrag Métall")).toBe("tarifvertrag-metall");
  });

  it("falls back for empty input", () => {
    expect(slugify("***")).toBe("agreement");
  });
});
