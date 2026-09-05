const form = document.getElementById("auth-form") as HTMLFormElement | null;
const statusEl = document.getElementById("status");

if (form) {
  const isRegister = location.pathname.startsWith("/register");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!statusEl) return;
    const fd = new FormData(form);
    try {
      const res = await fetch(`${window.__API__}/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.error ?? "Failed";
        return;
      }
      location.href = "/";
    } catch {
      statusEl.textContent = "Could not reach the API.";
    }
  });
}
