// Finds text that spills out of its own box, and anything past the screen edge, on every page.
// Finds text that spills out of its box, or anything past the screen edge, on every page
// at phone and tablet widths. Same env vars as app.mjs.
import { chromium } from "playwright";
const WEB = process.env.WEB ?? "http://localhost:5173";
const API = process.env.API ?? "http://localhost:8000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

// make sure there is content on the recipe pages
const mk = async (body) => (await (await fetch(`${API}/api/recipes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()).id;
const longId = await mk({ title: "Great-grandmother Philomena's extraordinarily slow-simmered Sunday ragù alla bolognese", speaker_name: "Great-grandmother Philomena Bartholomew-Castellanos",
  story: "She never measured anything and the kitchen windows steamed up by noon every Sunday.", servings: "eight to ten hungry grandchildren", prep_time: "forty-five unhurried minutes", cook_time: "three to four hours, never less",
  quote: "Supercalifragilisticexpialidociously slow, my dear, that is the only way", ingredients: [{ name: "extraordinarilylongingredientnamewithoutspaces", quantity: "500 grams", note: "minced twice by the butcher" }],
  steps: ["Stir slowly.", "https://example.com/a/very/long/url/that/should/wrap/instead/of/overflowing/the/screen/on/small/phones"], tips: ["Never rush it."] });

const pages = ["/", "/recipes", `/recipes/${longId}`, `/recipes/${longId}?edit=1`, "/add", "/book", "/guide", "/credits", "/privacy", "/terms", "/accessibility", "/account", "/signin", "/nope"];
const widths = [320, 360, 390, 414, 768];
let problems = 0;
for (const w of widths) {
  const page = await b.newPage({ viewport: { width: w, height: 800 } });
  for (const path of pages) {
    await page.goto(WEB + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const found = await page.evaluate((vw) => {
      const out = [];
      const visible = (el) => { const s = getComputedStyle(el); return s.display !== "none" && s.visibility !== "hidden" && el.getClientRects().length; };
      for (const el of document.querySelectorAll("main *, header *, footer *")) {
        if (!visible(el) || el.closest("[aria-hidden='true'],svg,canvas,.sr-only")) continue;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        // 1. past the right edge of the screen
        if (r.right > vw + 1 && r.width > 0 && !el.closest("[data-allow-offscreen]")) {
          const kids = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1);
          if (!kids) out.push(`off-screen ${Math.round(r.right - vw)}px: <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> "${el.textContent.trim().slice(0, 40)}"`);
        }
        // 2. text wider than its own box and not deliberately clipped/scrolled
        if (ownText && el.scrollWidth > el.clientWidth + 2 && s.overflowX === "visible" && s.textOverflow !== "ellipsis" && el.clientWidth > 0) {
          out.push(`spills ${el.scrollWidth - el.clientWidth}px: <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> "${el.textContent.trim().slice(0, 40)}"`);
        }
      }
      if (document.documentElement.scrollWidth > vw + 1) out.unshift(`PAGE scrolls sideways by ${document.documentElement.scrollWidth - vw}px`);
      return [...new Set(out)].slice(0, 6);
    }, w);
    if (found.length) { problems += found.length; console.log(`\n${w}px ${path}\n  ` + found.join("\n  ")); }
  }
  await page.close();
}
await fetch(`${API}/api/recipes/${longId}`, { method: "DELETE" });
await b.close();
console.log(`\n${problems} problem(s) across ${widths.length} widths x ${pages.length} pages`);
process.exitCode = problems ? 1 : 0;
