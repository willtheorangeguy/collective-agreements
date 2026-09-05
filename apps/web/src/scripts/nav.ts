// Swaps the static "Sign in" button for the signed-in menu. The site is fully
// static, so session state can only be resolved on the client.
const slot = document.getElementById("nav-auth");

interface Me {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "trusted" | "moderator" | "admin";
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

async function render(): Promise<void> {
  if (!slot) return;
  let me: Me | null = null;
  try {
    const res = await fetch(`${window.__API__}/auth/me`, { credentials: "include" });
    if (res.ok) me = (await res.json()) as Me;
  } catch {
    return; // API down: leave the static "Sign in" button in place.
  }
  if (!me) return;

  const isModerator = me.role === "moderator" || me.role === "admin";
  slot.innerHTML = `
    <a href="/dashboard/me" class="hover:underline">My activity</a>
    ${isModerator ? '<a href="/dashboard/moderation" class="hover:underline">Moderation</a>' : ""}
    <span class="hidden text-stone-500 sm:inline">${esc(me.displayName)}${
      me.role !== "user" ? ` <span class="rounded bg-stone-100 px-1.5 py-0.5 text-xs">${esc(me.role)}</span>` : ""
    }</span>
    <button id="nav-logout" class="rounded border border-stone-300 px-3 py-1.5 hover:bg-stone-100">Sign out</button>`;

  document.getElementById("nav-logout")?.addEventListener("click", async () => {
    await fetch(`${window.__API__}/auth/logout`, { method: "POST", credentials: "include" });
    location.href = "/";
  });
}

void render();
