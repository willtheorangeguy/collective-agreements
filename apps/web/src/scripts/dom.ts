export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** Relative day count — an agreement that expired last year should look stale. */
export function expiryNote(expiry: string | null | undefined): {
  label: string;
  tone: "expired" | "soon" | "ok" | "unknown";
} {
  if (!expiry) return { label: "No expiry recorded", tone: "unknown" };
  const end = new Date(`${expiry}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return { label: expiry, tone: "unknown" };
  const days = Math.round((end - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${fmtDate(expiry)}`, tone: "expired" };
  if (days <= 90) return { label: `Expires ${fmtDate(expiry)}`, tone: "soon" };
  return { label: `Runs to ${fmtDate(expiry)}`, tone: "ok" };
}
