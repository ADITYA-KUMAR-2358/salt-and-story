// Smoke test for Google sign-in mode. Needs an API running with AUTH_MODE=google and a
// GOOGLE_CLIENT_ID (a test one is fine), and the app built against it.
//   WEB=http://localhost:5174 API=http://localhost:8010 node signin.mjs
import { chromium } from "playwright";

const WEB = process.env.WEB ?? "http://localhost:5174";
const API = process.env.API ?? "http://localhost:8010";
const results = [];
const check = async (name, fn) => {
  try { const d = await fn(); results.push(`PASS  ${name}${d ? "  " + d : ""}`); }
  catch (e) { results.push(`FAIL  ${name}  ${String(e.message).split("\n")[0].slice(0, 200)}`); }
};

await check("API is in Google mode and publishes the client id", async () => {
  const c = await (await fetch(`${API}/api/auth/config`)).json();
  if (c.mode !== "google" || !c.google_client_id) throw new Error(JSON.stringify(c));
  return `daily limit ${c.daily_limit}`;
});
await check("API refuses recipe requests without a session", async () => {
  for (const path of ["/api/recipes", "/api/auth/me", "/api/export"]) {
    const s = (await fetch(`${API}${path}`)).status;
    if (s !== 401) throw new Error(`${path} -> ${s}`);
  }
});
await check("API rejects a forged Google credential", async () => {
  const r = await fetch(`${API}/api/auth/google`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "eyJhbGciOiJSUzI1NiJ9.forged-token-payload.forged-signature" }) });
  if (r.status !== 401) throw new Error(`status ${r.status}`);
});

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const cspErrors = [];
page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) cspErrors.push(m.text().slice(0, 160)); });

await check("Protected pages send visitors to sign in, then back", async () => {
  for (const path of ["/recipes", "/add", "/book", "/account"]) {
    await page.goto(WEB + path, { waitUntil: "networkidle" });
    const url = new URL(page.url());
    if (url.pathname !== "/signin" || url.searchParams.get("next") !== path) throw new Error(`${path} -> ${page.url()}`);
  }
});
await check("Public pages stay public", async () => {
  for (const path of ["/", "/guide", "/privacy", "/terms", "/accessibility", "/credits"]) {
    await page.goto(WEB + path, { waitUntil: "networkidle" });
    if (new URL(page.url()).pathname !== path) throw new Error(`${path} redirected to ${page.url()}`);
  }
});
await check("Header offers Sign in when signed out", async () => {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Sign in" }).first().waitFor();
});
await check("Sign-in page loads Google's real button", async () => {
  await page.goto(`${WEB}/signin?next=%2Fbook`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Sign in to your family cookbook" }).waitFor();
  // "attached", not visible: with a made-up test client id Google answers the frame with 403 and hides it.
  const frame = page.locator('iframe[src*="accounts.google.com/gsi/button"]');
  await frame.waitFor({ state: "attached", timeout: 20000 });
  await page.screenshot({ path: "shots/signin_google.png" });
  return `button frame: ${(await frame.getAttribute("src")).split("?")[0]}`;
});
await check("Open redirects are refused (next must be a same-site path)", async () => {
  await page.goto(`${WEB}/signin?next=https://evil.example`, { waitUntil: "networkidle" });
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  if (hrefs.some((h) => h?.includes("evil.example"))) throw new Error("external next leaked into a link");
});
await check("Google's sign-in is allowed by the security policy", async () => {
  if (cspErrors.length) throw new Error(cspErrors.join(" | "));
});

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
