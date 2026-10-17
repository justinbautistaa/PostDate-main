// Read-only smoke checks: no accounts, messages, uploads or provider calls.
const base = new URL(process.argv[2] || "https://postdate.onrender.com");
if (base.protocol !== "https:" || base.pathname !== "/" || base.username || base.password || base.search || base.hash) {
  throw new Error("Provide an HTTPS origin, without credentials, a path or query parameters");
}
async function check(path, expected, options = {}) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(60000), redirect: "error" });
  if (response.status !== expected) throw new Error(`Unexpected status for ${path}: ${response.status}`);
  console.log(`${path}: ${response.status}`);
  return response;
}
async function run() {
  const health = await check("/healthz", 200);
  if ((await health.json()).status !== "ready") throw new Error("The service is not ready");
  const home = await check("/", 200);
  if (!home.headers.get("content-security-policy")?.includes("script-src 'self'") || !home.headers.has("strict-transport-security")) {
    throw new Error("Missing production security headers");
  }
  const html = await home.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"<>]+)"/g)].map(match => match[1]);
  if (!assets.some(path => path.endsWith(".js"))) throw new Error("No compiled application script found");
  for (const path of new Set(assets)) {
    const response = await check(path, 200);
    const type = response.headers.get("content-type") || "";
    if ((path.endsWith(".js") && !/javascript/.test(type)) || (path.endsWith(".css") && !/text\/css/.test(type))) {
      throw new Error("A compiled asset has the wrong content type");
    }
  }
  for (const path of ["/login", "/signup", "/profile", "/dashboard", "/messages", "/admin", "/staff", "/privacy", "/appeal"]) await check(path, 200);
  for (const path of ["/api/tags", "/api/stats"]) await check(path, 200);
  for (const path of ["/api/auth/session", "/api/discover", "/api/matches/history", "/api/admin/overview"]) await check(path, 401);
  await check("/api/stats", 403, { headers: { Origin: "https://untrusted.example" } });
  await check("/api/not-a-route", 404);
  console.log("Deployment smoke checks passed. Authenticated flows still require a test account.");
}
run().catch(error => {
  // Fixed labels and paths only; never print provider responses or credentials.
  console.error(error.message.startsWith("Unexpected status for ") ? error.message : "Deployment smoke check failed");
  process.exitCode = 1;
});
