import type { APIRoute } from "astro";

const api = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";

// Trailing slashes match what Astro's directory-format build serves, and what
// each page declares as its canonical URL.
const STATIC_PATHS = [
  "/",
  "/agreements/",
  "/changes/",
  "/submit/",
  "/contribute/",
  "/about/",
  "/faq/",
];

interface Item {
  slug: string;
  createdAt: string;
}

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

async function allAgreements(): Promise<Item[]> {
  const list: Item[] = [];
  let offset = 0;
  try {
    for (;;) {
      const res = await fetch(`${api}/agreements?limit=100&offset=${offset}`);
      if (!res.ok) break;
      const data = (await res.json()) as { items: Item[] };
      list.push(...data.items);
      if (data.items.length < 100) break;
      offset += 100;
    }
  } catch {
    console.warn("API unreachable during build; sitemap contains static pages only");
  }
  return list;
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    // Without a configured `site` no absolute URLs can be produced, and a
    // sitemap of relative URLs is invalid — better to emit an empty one.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  const agreements = await allAgreements();
  const urls = [
    ...STATIC_PATHS.map((p) => ({ loc: new URL(p, site).href, lastmod: null as string | null })),
    ...agreements.map((a) => ({
      loc: new URL(`/agreements/${a.slug}/`, site).href,
      lastmod: a.createdAt ? new Date(a.createdAt).toISOString() : null,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${xmlEscape(u.loc)}</loc>${
        u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""
      }</url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
