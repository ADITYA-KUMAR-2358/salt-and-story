// End-to-end checks for Salt & Story in a real browser (Playwright).
//
//   cd e2e && npm ci && npx playwright install chromium   (once)
//   WEB=http://localhost:8080 API=http://localhost:8080 npm test
//
// WEB / API: where the app and API run (same origin under Docker Compose).
// CHROME_PATH: use an installed Chrome instead of Playwright's Chromium.
// REQUIRE_PDF=1: fail if the PDF engine is missing (it is always present in Docker).
// The AI test writes a real recipe when the server can reach the model; otherwise it
// checks that the failure is explained clearly (CI runs without secrets).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const WEB = process.env.WEB ?? "http://localhost:5173";
const API = process.env.API ?? "http://localhost:8000";
const OUT = path.join(HERE, "shots");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const problems = [];
const ok = (name, detail = "") => { results.push(`PASS  ${name}${detail ? "  " + detail : ""}`); };
const bad = (name, detail = "") => { results.push(`FAIL  ${name}  ${detail}`); problems.push(name); };
const check = async (name, fn) => { try { const d = await fn(); ok(name, d ?? ""); } catch (e) { bad(name, String(e.message ?? e).split("\n")[0].slice(0, 220)); } };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  page._errors = [];
  page.on("console", (m) => { if (m.type() === "error") page._errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => page._errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.includes("/@vite") && !u.endsWith(".map") && r.failure()?.errorText !== "net::ERR_ABORTED") page._errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => { if (r.status() >= 500) page._errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return page;
}
const flush = (page, name) => {
  const errs = page._errors.splice(0);
  // Expected: PDF engine missing on Windows dev box (503 on book/pdf).
  const real = errs.filter((e) => !/book\.pdf|\/pdf\b|503/.test(e) && !(name.includes("999999") && /404/.test(e)));
  if (real.length) bad(`${name}: no console/network errors`, real.join(" | "));
  else ok(`${name}: no console/network errors`);
};
const shot = (page, name, full = true) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

// ---------- 0. API + CORS --------------------------------------------------
await check("API /health", async () => { const r = await fetch(`${API}/health`); if (!r.ok) throw new Error(r.status); });
await check("API /api/status", async () => {
  const s = await (await fetch(`${API}/api/status`)).json();
  return `transcription=${s.transcription} llm.reachable=${s.llm.reachable} model=${s.llm.model}`;
});
await check("CORS preflight from frontend origin", async () => {
  const r = await fetch(`${API}/api/recipes`, { method: "OPTIONS", headers: { Origin: WEB, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
  const allow = r.headers.get("access-control-allow-origin");
  if (r.status !== 200 || allow !== WEB) throw new Error(`status ${r.status}, allow-origin ${allow}`);
  return `allow-origin=${allow}`;
});
await check("CORS rejects unknown origin", async () => {
  const r = await fetch(`${API}/api/recipes`, { headers: { Origin: "https://evil.example" } });
  if (r.headers.get("access-control-allow-origin")) throw new Error("unknown origin was allowed");
});

// ---------- 1. Every route, desktop + mobile ------------------------------
const routes = ["/", "/recipes", "/add", "/book", "/guide", "/credits", "/privacy", "/terms", "/accessibility", "/no-such-page", "/recipes/999999"];
const DEVICES = [
  ["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }],
  ["small", { width: 320, height: 640 }], ["tablet", { width: 768, height: 1024 }],
  ["laptop", { width: 1024, height: 768 }], ["wide", { width: 1920, height: 1080 }],
];
for (const [label, vp] of DEVICES) {
  const page = await newPage(vp);
  for (const r of (["desktop", "mobile"].includes(label) ? routes : ["/", "/recipes", "/add", "/book", "/guide"])) {
    const name = `${label}${r.replace(/\//g, "_") || "_home"}`;
    await check(`${label} ${r} renders`, async () => {
      const res = await page.goto(WEB + r, { waitUntil: "networkidle" });
      if (!res || res.status() !== 200) throw new Error(`status ${res?.status()}`);
      await page.waitForSelector("main h1", { timeout: 15000 });
      const h1 = (await page.locator("main h1").first().innerText()).replace(/\s+/g, " ");
      if (r === "/") await scrollThrough(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
      if (["desktop", "mobile"].includes(label) || r === "/") await shot(page, name, label === "desktop" || r === "/");
      return `h1="${h1.slice(0, 60)}"`;
    });
    flush(page, `${label} ${r}`);
  }
  await page.context().close();
}

// ---------- 2. Flows ------------------------------------------------------
const page = await newPage({ width: 1440, height: 900 });

const topCard = () => page.locator('.hero-card button[tabindex="0"]');
const deckOrder = () => page.evaluate(() =>
  [...document.querySelectorAll(".hero-card button")].map((b) => ({ who: b.getAttribute("aria-label").split(",")[0], z: Number(getComputedStyle(b).zIndex) }))
    .sort((a, b) => b.z - a.z).map((x) => x.who));
await check("Hero deck: tap sends the top story to the back (FIFO)", async () => {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const before = await deckOrder();
  await topCard().click();
  await page.waitForTimeout(1600);
  const after = await deckOrder();
  const expected = [...before.slice(1), before[0]];
  if (JSON.stringify(after) !== JSON.stringify(expected)) throw new Error(`before ${before} after ${after}`);
  await page.screenshot({ path: path.join(OUT, "hero_deck_after_tap.png") });
  return `${before[0]} moved to the back; now on top: ${after[0]}`;
});
await check("Hero deck: no arrow buttons, keyboard Left brings the last story to the front", async () => {
  if (await page.getByRole("button", { name: /Previous story|Next story/ }).count()) throw new Error("arrow buttons still present");
  const before = await deckOrder();
  await topCard().focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(1600);
  const after = await deckOrder();
  const expected = [before[before.length - 1], ...before.slice(0, -1)];
  if (JSON.stringify(after) !== JSON.stringify(expected)) throw new Error(`before ${before} after ${after}`);
});
await check("Hero deck: dots jump to a story", async () => {
  await page.getByRole("button", { name: /Story 3 of/ }).click();
  await page.waitForTimeout(3500);
  const label = await topCard().getAttribute("aria-label");
  if (!label.startsWith("Mamie Odile")) throw new Error(label);
});
await check("Hero deck: hover fans the stack", async () => {
  const photo = page.locator(".hero-photo");
  await photo.hover({ position: { x: 60, y: 60 } });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "hero_deck_hover.png") });
});
flush(page, "hero carousel");

await check("404 page shows custom content", async () => {
  await page.goto(`${WEB}/definitely/not/here`, { waitUntil: "networkidle" });
  await page.getByText("This page is not in the cookbook").waitFor();
});

let classicId = null;
await check("Add a classic from landing (with photo)", async () => {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.locator("#classics").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Add to my book" }).first().click();
  const link = page.getByRole("link", { name: /Added\. Open it/ });
  await link.waitFor({ timeout: 20000 });
  classicId = Number((await link.getAttribute("href")).split("/").pop());
  const r = await (await fetch(`${API}/api/recipes/${classicId}`)).json();
  if (!r.photo_url) throw new Error("photo was not attached");
  return `recipe ${classicId}, photo ${r.photo_url}`;
});
flush(page, "add classic");

await check("Recipe page renders read view", async () => {
  await page.goto(`${WEB}/recipes/${classicId}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Ingredients" }).waitFor();
  await page.getByRole("button", { name: "Start cooking" }).waitFor();
  await shot(page, "flow_recipe_read");
});

await check("Ingredient check-off and step tap", async () => {
  await page.locator(".check-row input[type=checkbox]").first().check();
  await page.locator("ol .check-row button").first().click();
  const done = await page.locator('.check-row[data-done="true"]').count();
  if (done < 2) throw new Error(`done rows ${done}`);
});

await check("Cook mode opens, steps forward, Esc closes", async () => {
  await page.getByRole("button", { name: "Start cooking" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByText(/Step 1 of \d+/).waitFor();
  await page.keyboard.press("ArrowRight");
  await page.getByText(/Step 2 of \d+/).waitFor();
  await shot(page, "flow_cook_mode", false);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
});

await check("Edit: unsaved-changes guard blocks navigation", async () => {
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Title").fill("Grandma Ruth's pie (edited)");
  await page.getByRole("link", { name: "Back to recipes" }).click();
  await page.getByRole("heading", { name: "Leave without saving?" }).waitFor();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await shot(page, "flow_recipe_edit");
});

await check("Edit: save persists", async () => {
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  const r = await (await fetch(`${API}/api/recipes/${classicId}`)).json();
  if (r.title !== "Grandma Ruth's pie (edited)") throw new Error(`title is ${r.title}`);
});

await check("Photo replace via file input", async () => {
  const before = (await (await fetch(`${API}/api/recipes/${classicId}`)).json()).photo_url;
  await page.locator('input[type=file][accept^="image"]').setInputFiles(path.join(ROOT, "frontend/public/images/biscuits-640.webp"));
  await page.getByText("Photo added").waitFor({ timeout: 15000 });
  const after = (await (await fetch(`${API}/api/recipes/${classicId}`)).json()).photo_url;
  if (after === before) throw new Error("photo url did not change");
});

await check("Library lists it, search works", async () => {
  await page.goto(`${WEB}/recipes`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /pie \(edited\)/ }).first().waitFor();
  await page.getByLabel("Search recipes").fill("zzznomatch");
  await page.getByText("No recipes match that search.").waitFor();
  await page.getByLabel("Search recipes").fill("edited");
  await page.getByRole("link", { name: /pie \(edited\)/ }).first().waitFor();
  await shot(page, "flow_library");
});

await check("Backup downloads JSON", async () => {
  await page.getByLabel("Search recipes").fill("");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Back up recipes" }).click()]);
  const p = await dl.path();
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(data) || !data.length) throw new Error("empty backup");
  return `${data.length} recipes`;
});
flush(page, "library + backup");

await check("Book: title and dedication fields line up", async () => {
  await page.goto(`${WEB}/book`, { waitUntil: "networkidle" });
  const t = await page.getByLabel("Book title").boundingBox();
  const d = await page.getByLabel("Dedication").boundingBox();
  if (!t || !d) throw new Error("fields not found");
  if (Math.abs(t.y - d.y) > 1 || Math.abs(t.height - d.height) > 1) {
    throw new Error(`title y=${t.y} h=${t.height} vs dedication y=${d.y} h=${d.height}`);
  }
});

await check("Book: 'Recipes told by' can be changed, cleared and reset", async () => {
  const field = page.getByLabel("Recipes told by");
  await field.fill("Nani and the whole family");
  await page.getByRole("img", { name: "Cover preview" }).getByText("Recipes told by Nani and the whole family").waitFor();
  await field.fill("");
  if (await page.getByRole("img", { name: "Cover preview" }).getByText(/Recipes told by/).count()) throw new Error("empty value should hide the line");
  await page.getByRole("button", { name: "Use the cooks' names" }).click();
  if (await page.getByRole("button", { name: "Use the cooks' names" }).count()) throw new Error("reset button should disappear");
});

await check("Book: select, cover preview, build", async () => {
  await page.goto(`${WEB}/book`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Select all" }).click();
  await page.getByLabel("Dedication").fill("the whole family");
  await page.getByText("For the whole family").waitFor();
  await page.getByRole("button", { name: "Build the book" }).click();
  const outcome = await Promise.race([
    page.getByRole("link", { name: "Download PDF" }).waitFor({ timeout: 90000 }).then(() => "pdf"),
    page.getByText(/PDF engine is not available|PDF export needs the Pango/).waitFor({ timeout: 90000 }).then(() => "engine-missing"),
  ]);
  await shot(page, "flow_book");
  if (outcome === "engine-missing") {
    if (process.env.REQUIRE_PDF) throw new Error("PDF engine missing");
    return "readable error: PDF engine missing locally (works in Docker)";
  }
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  const head = fs.readFileSync(await dl.path()).subarray(0, 5).toString();
  if (head !== "%PDF-") throw new Error(`download is not a PDF: ${head}`);
  return `real PDF built and downloaded (${fs.statSync(await dl.path()).size} bytes)`;
});
flush(page, "book");

const modelUp = (await (await fetch(`${API}/api/status`)).json()).llm.reachable;
await check(modelUp ? "Add memo: paste flow through real Gemma" : "Add memo: paste flow explains a missing model clearly", async () => {
  await page.goto(`${WEB}/add`, { waitUntil: "networkidle" });
  await page.getByText("Paste words").click();
  await page.getByLabel("Who is telling this recipe?").fill("Oma Greta");
  await page.getByRole("button", { name: "Try a sample" }).click();
  const len = (await page.getByLabel("What they said").inputValue()).length;
  if (len < 50) throw new Error("sample did not load");
  // A unique ending so the run never reuses an earlier recipe and really exercises the model.
  await page.getByLabel("What they said").fill((await page.getByLabel("What they said").inputValue()) + ` Test run ${Date.now()}.`);
  await shot(page, "flow_add_paste");
  await page.getByRole("button", { name: "Make the recipe" }).click();
  await page.getByRole("heading", { name: "Making your recipe" }).waitFor();
  await shot(page, "flow_add_progress", false);
  const t0 = Date.now();
  const outcome = await Promise.race([
    page.waitForURL(/\/recipes\/\d+$/, { timeout: 280000 }).then(() => "ok"),
    page.getByText("That did not work").waitFor({ timeout: 280000 }).then(() => "failed"),
  ]);
  if (outcome === "failed") {
    await shot(page, "flow_add_failed", false);
    const msg = await page.locator(".bg-danger-soft p").nth(1).innerText();
    if (!modelUp && /LLM_API_KEY|recipe writer|Try again/i.test(msg)) return `no model here; explained as: "${msg.slice(0, 90)}"`;
    throw new Error(`memo failed with a readable message: "${msg}"`);
  }
  await page.getByRole("heading", { name: "Ingredients" }).waitFor();
  const id = Number(page.url().split("/").pop());
  const r = await (await fetch(`${API}/api/recipes/${id}`)).json();
  await shot(page, "flow_gemma_recipe");
  return `ready in ${((Date.now() - t0) / 1000).toFixed(0)}s: "${r.title}", ${r.ingredients.length} ingredients, ${r.steps.length} steps`;
});
flush(page, "paste flow");


// ---------- Favourites and deleting from the library -------------------------
const mk = async (title) => (await (await fetch(`${API}/api/recipes`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title, steps: ["Stir."], quote: "", story: "" }) })).json()).id;
const favId = await mk("Favourite test pudding");
const delId = await mk("Delete test broth");

await check("Favourites: heart a recipe from Your recipes", async () => {
  await page.goto(`${WEB}/recipes`, { waitUntil: "networkidle" });
  const heart = page.getByRole("button", { name: "Add Favourite test pudding to favourites" });
  await heart.click();
  await page.getByRole("button", { name: "Remove Favourite test pudding from favourites" }).waitFor();
  await page.getByText("Added to favourites").first().waitFor();
  const r = await (await fetch(`${API}/api/recipes/${favId}`)).json();
  if (!r.favorite) throw new Error("not saved on the server");
});

await check("Favourites: filter shows only favourites and survives reload", async () => {
  await page.getByRole("button", { name: /^Favourites \d+$/ }).click();
  await page.waitForURL(/show=favourites/);
  const titles = await page.locator("main ul h3").allInnerTexts();
  if (!titles.includes("Favourite test pudding") || titles.includes("Delete test broth")) throw new Error(titles.join(", "));
  await page.reload({ waitUntil: "networkidle" });
  const again = await page.locator("main ul h3").allInnerTexts();
  if (!again.includes("Favourite test pudding") || again.includes("Delete test broth")) throw new Error("filter lost on reload");
  await shot(page, "flow_favourites");
  return `${again.length} favourite(s) shown`;
});

await check("Favourites: heart on the recipe page, and Select favourites in the book", async () => {
  await page.goto(`${WEB}/recipes/${favId}`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: "Remove Favourite test pudding from favourites" });
  if ((await btn.getAttribute("aria-pressed")) !== "true") throw new Error("recipe page heart not pressed");
  await page.goto(`${WEB}/book`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Clear" }).click().catch(() => {});
  await page.getByRole("button", { name: "Select favourites" }).click();
  const picked = await page.getByText(/recipes? selected/).innerText();
  const favs = (await (await fetch(`${API}/api/recipes?favorite=true`)).json()).filter((r) => r.status === "ready").length;
  if (!picked.startsWith(`${favs} recipe`)) throw new Error(`${picked} vs ${favs} favourites`);
  // unfavourite from the recipe page
  await page.goto(`${WEB}/recipes/${favId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Remove Favourite test pudding from favourites" }).click();
  await page.getByRole("button", { name: "Add Favourite test pudding to favourites" }).waitFor();
  if ((await (await fetch(`${API}/api/recipes/${favId}`)).json()).favorite) throw new Error("unfavourite not saved");
});

await check("Delete from Your recipes: cancel keeps it, confirm removes it", async () => {
  await page.goto(`${WEB}/recipes`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete Delete test broth" }).click();
  await page.getByRole("heading", { name: "Delete Delete test broth?" }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  if ((await fetch(`${API}/api/recipes/${delId}`)).status !== 200) throw new Error("cancel deleted it");
  await page.getByRole("button", { name: "Delete Delete test broth" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.getByText("Recipe deleted").first().waitFor();
  if (await page.locator("main ul h3", { hasText: "Delete test broth" }).count()) throw new Error("tile still shown");
  if ((await fetch(`${API}/api/recipes/${delId}`)).status !== 404) throw new Error("still on the server");
  await fetch(`${API}/api/recipes/${favId}`, { method: "DELETE" });
});
flush(page, "favourites + library delete");

await check("Delete with confirm dialog", async () => {
  await page.goto(`${WEB}/recipes/${classicId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("heading", { name: "Delete this recipe?" }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/recipes$/);
  const r = await fetch(`${API}/api/recipes/${classicId}`);
  if (r.status !== 404) throw new Error(`still exists (${r.status})`);
});
flush(page, "delete");

await check("Footer: sections, legal pages, signature and GitHub link", async () => {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  for (const name of ["Privacy", "Terms of use", "Accessibility", "Questions and fixes", "Photo credits"]) {
    await page.getByRole("contentinfo").getByRole("link", { name }).waitFor();
  }
  await page.getByRole("contentinfo").getByRole("link", { name: "Questions and fixes" }).click();
  await page.waitForURL(/\/guide#faq$/);
  await page.waitForTimeout(600);
  const faqTop = await page.locator("#faq").evaluate((el) => el.getBoundingClientRect().top);
  if (faqTop > 300 || faqTop < -50) throw new Error(`#faq not scrolled into view (top ${faqTop})`);

  await page.goto(WEB + "/recipes", { waitUntil: "networkidle" });
  await page.getByText("Built by Aditya Kumar").waitFor();
  const href = await page.getByRole("link", { name: /Aditya on GitHub/ }).getAttribute("href");
  if (href !== "https://github.com/ADITYA-KUMAR-2358") throw new Error(href);
});


// ---------- Broken-link crawl: every link on every page ----------------------
await check("No broken links (internal routes, in-page anchors, external sites)", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const pages = ["/", "/recipes", "/add", "/book", "/guide", "/credits", "/privacy", "/terms", "/accessibility", "/no-such-page"];
  const internal = new Set(), external = new Set(), anchors = [];
  for (const route of pages) {
    await p.goto(WEB + route, { waitUntil: "networkidle" });
    await p.waitForSelector("main h1");
    const hrefs = await p.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (!h || h.startsWith("blob:")) continue;
      if (h.startsWith("#")) anchors.push([route, h.slice(1)]);
      else if (/^https?:/.test(h)) external.add(h);
      else internal.add(h);
    }
  }
  const broken = [];
  for (const [route, id] of anchors) {
    await p.goto(WEB + route, { waitUntil: "networkidle" });
    if (!(await p.locator(`[id="${id}"]`).count())) broken.push(`${route}#${id} (missing anchor)`);
  }
  for (const h of internal) {
    const [path, hash] = h.split("#");
    await p.goto(WEB + path, { waitUntil: "networkidle" });
    await p.waitForSelector("main h1");
    const h1 = await p.locator("main h1").first().innerText();
    if (/not in the cookbook/.test(h1) && !/no-such-page|999999/.test(path)) broken.push(`${h} (404 page)`);
    if (hash && !(await p.locator(`[id="${hash}"]`).count())) broken.push(`${h} (missing anchor)`);
  }
  for (const h of external) {
    try {
      const r = await fetch(h, { method: "GET", redirect: "follow", headers: { "User-Agent": "SaltAndStory-linkcheck/1.0" } });
      if (r.status >= 400) broken.push(`${h} (HTTP ${r.status})`);
    } catch (e) { broken.push(`${h} (${e.message})`); }
  }
  await ctx.close();
  if (broken.length) throw new Error(broken.join(" | "));
  return `${internal.size} internal links, ${anchors.length} in-page anchors, ${external.size} external links: all OK`;
});

await check("Keyboard: skip link and visible focus", async () => {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (focused !== "Skip to content") throw new Error(`first tab stop: ${focused}`);
});

await check("Reduced motion: content visible without animation", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(WEB + "/", { waitUntil: "networkidle" });
  const op = await p.locator(".hero-line").first().evaluate((el) => getComputedStyle(el).transform);
  await ctx.close();
  if (op !== "none" && !op.startsWith("matrix(1, 0, 0, 1, 0, 0")) throw new Error(`hero still transformed: ${op}`);
});

await check("Dark mode renders", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  await p.goto(WEB + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, "dark_home.png") });
  await p.goto(WEB + "/recipes", { waitUntil: "networkidle" });
  await p.screenshot({ path: path.join(OUT, "dark_recipes.png"), fullPage: true });
  await ctx.close();
});

await browser.close();
console.log(results.join("\n"));
console.log(`\n${results.length - problems.length}/${results.length} passed`);
fs.writeFileSync(path.join(OUT, "results.txt"), results.join("\n"));
process.exitCode = problems.length ? 1 : 0;
