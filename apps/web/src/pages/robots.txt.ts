import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    // Editing and account screens are per-user and have nothing to index.
    "Disallow: /edit",
    "Disallow: /dashboard/",
    "Disallow: /agreements/pending",
    "Disallow: /login",
    "Disallow: /register",
    "",
  ];
  if (site) lines.push(`Sitemap: ${new URL("sitemap.xml", site).href}`, "");
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
