import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";

// The monorepo keeps a single .env at the root, one level above this app, so
// point Vite there instead of letting it look only in apps/web.
const envDir = fileURLToPath(new URL("../..", import.meta.url));

// PUBLIC_SITE_URL is what makes canonical URLs, the sitemap and the Atom feed
// absolute. astro.config runs before import.meta.env exists, so read it here.
// Without it those outputs are omitted rather than emitted wrong.
const { PUBLIC_SITE_URL } = loadEnv(process.env.NODE_ENV ?? "production", envDir, "");

export default defineConfig({
  site: PUBLIC_SITE_URL || undefined,
  vite: {
    envDir,
    plugins: [tailwindcss()],
  },
});
