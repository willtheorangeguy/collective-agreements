import { esc } from "./dom.js";

const FIELD_LABELS: Record<string, string> = {
  title_english: "English title",
  summary_english: "Summary",
  sector: "Sector",
  effective_date: "Effective date",
  expiry_date: "Expiry date",
  duration_notes: "Term and duration",
  coverage_estimate: "Who it covers",
  parties: "Parties",
  provisions: "Provisions",
  notable_clauses: "Notable clauses",
  wages: "Wages",
  working_hours: "Working hours",
  overtime: "Overtime",
  leave: "Leave",
  health_and_safety: "Health & safety",
  job_security: "Job security",
  grievance_procedure: "Grievance procedure",
  union_rights: "Union rights",
  training: "Training",
  other_notable: "Other notable points",
};

function label(key: string): string {
  return FIELD_LABELS[key] ?? key.replaceAll("_", " ");
}

function asText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "(none)";
    return value
      .map((v) =>
        typeof v === "string"
          ? `• ${v}`
          : `• ${Object.entries(v as Record<string, unknown>)
              .filter(([, x]) => x !== null && x !== "")
              .map(([k, x]) => `${label(k)}: ${String(x)}`)
              .join(" — ")}`,
      )
      .join("\n");
  }
  return JSON.stringify(value, null, 2);
}

interface Change {
  key: string;
  before: unknown;
  after: unknown;
}

/** Flattens one level into `provisions` so a wage correction reads as "Wages"
 *  rather than a diff of the whole provisions blob. */
function collect(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = "",
): Change[] {
  const changes: Change[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    if (
      key === "provisions" &&
      b && a &&
      typeof b === "object" && typeof a === "object" &&
      !Array.isArray(b) && !Array.isArray(a)
    ) {
      changes.push(...collect(b as Record<string, unknown>, a as Record<string, unknown>, ""));
      continue;
    }
    changes.push({ key: prefix + key, before: b, after: a });
  }
  return changes;
}

export function countChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): number {
  return collect(before, after).length;
}

/**
 * Side-by-side before/after per changed field. `before` is the content the edit
 * was proposed against; `after` is the proposed or stored revision.
 */
export function renderDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  emptyMessage = "No changes.",
): string {
  const changes = collect(before, after);
  if (changes.length === 0) return `<p class="text-sm text-stone-500">${esc(emptyMessage)}</p>`;

  return `<div class="space-y-2">${changes
    .map(
      (c) => `
      <div class="overflow-hidden rounded border border-stone-200">
        <div class="border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
          ${esc(label(c.key))}
        </div>
        <div class="grid gap-px bg-stone-200 sm:grid-cols-2">
          <div class="bg-red-50 p-3">
            <div class="text-xs font-medium text-red-800">before</div>
            <pre class="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-stone-700">${esc(asText(c.before))}</pre>
          </div>
          <div class="bg-green-50 p-3">
            <div class="text-xs font-medium text-green-800">after</div>
            <pre class="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-stone-700">${esc(asText(c.after))}</pre>
          </div>
        </div>
      </div>`,
    )
    .join("")}</div>`;
}
