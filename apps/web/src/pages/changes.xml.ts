import type { APIRoute } from "astro";

const api = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";
const siteName = import.meta.env.PUBLIC_SITE_NAME ?? "Collective Agreements";

interface Change {
  id: string;
  slug: string;
  title: string;
  isAi: boolean;
  editSummary: string | null;
  createdAt: string;
  editorName: string | null;
}

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

/** Atom feed of published revisions, so editors can watch the library for bad
 *  edits without refreshing the site by hand. */
export const GET: APIRoute = async ({ site }) => {
  let items: Change[] = [];
  try {
    const res = await fetch(`${api}/agreements/feed/changes?limit=50`);
    if (res.ok) items = ((await res.json()) as { items: Change[] }).items;
  } catch {
    console.warn("API unreachable during build; changes feed will be empty");
  }

  // Atom requires absolute links. Without a configured `site` there is no way to
  // build them, so fall back to a valid-but-local base rather than crashing.
  const base = site?.href ?? "http://localhost:4321/";
  const updated = items[0]?.createdAt
    ? new Date(items[0].createdAt).toISOString()
    : new Date().toISOString();

  const entries = items
    .map((c) => {
      const url = new URL(`/agreements/${c.slug}/`, base).href;
      const who = c.isAi ? "AI analysis" : (c.editorName ?? "a community editor");
      const summary = c.editSummary ? `${who}: ${c.editSummary}` : `Updated by ${who}`;
      return `  <entry>
    <title>${xmlEscape(c.title)}</title>
    <link href="${xmlEscape(url)}"/>
    <id>urn:revision:${xmlEscape(c.id)}</id>
    <updated>${new Date(c.createdAt).toISOString()}</updated>
    <author><name>${xmlEscape(who)}</name></author>
    <summary>${xmlEscape(summary)}</summary>
  </entry>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEscape(siteName)} — recent changes</title>
  <link href="${xmlEscape(new URL("/changes.xml", base).href)}" rel="self"/>
  <link href="${xmlEscape(base)}"/>
  <id>${xmlEscape(new URL("/changes.xml", base).href)}</id>
  <updated>${updated}</updated>
${entries}
</feed>`;

  return new Response(body, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
};
