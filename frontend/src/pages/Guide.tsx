import { CaretDown, CheckCircle, Plus } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { guide } from "../content/guide";
import { useTitle } from "../hooks";
import { t } from "../strings";

export default function Guide() {
  useTitle("Guide");
  const [active, setActive] = useState(guide.sections[0].id);
  const { hash } = useLocation();

  // Links like /guide#faq: scroll once the lazily loaded page is on screen.
  useEffect(() => {
    if (!hash) return;
    // After the router's own scroll reset; jump, don't animate, so the reader lands at once.
    const id = requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(id);
  }, [hash]);

  // Highlight the section being read in the table of contents.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-20% 0px -70% 0px" },
    );
    guide.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-5xl font-extrabold md:text-6xl">{guide.title}</h1>
        <p className="mt-4 text-xl text-muted">{guide.lead}</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={guide.toc} className="hidden lg:block">
          <div className="sticky top-6 grid gap-1">
            <p className="mb-2 font-semibold text-muted">{guide.toc}</p>
            {guide.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}
                className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                  active === s.id ? "bg-surface text-primary lift" : "text-muted hover:text-ink"}`}>{s.title}</a>
            ))}
            <a href="#faq" className="rounded-full px-4 py-2 font-semibold text-muted hover:text-ink">{guide.faqTitle}</a>
          </div>
        </nav>

        <div className="grid max-w-3xl gap-14">
          {guide.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6">
              <h2 id={`${s.id}-h`} className="font-display text-3xl font-extrabold">{s.title}</h2>
              {s.intro && <p className="mt-2 text-lg text-muted">{s.intro}</p>}
              {s.steps && (
                <ol className="mt-5 grid gap-3">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-4 rounded-[var(--r)] bg-surface p-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-on-primary">{i + 1}</span>
                      <span className="pt-1">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.tips && (
                <ul className="mt-5 grid gap-3">
                  {s.tips.map((tip, i) => (
                    <li key={i} className="flex gap-3">
                      <CheckCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section id="faq" aria-labelledby="faq-h" className="scroll-mt-6">
            <h2 id="faq-h" className="font-display text-3xl font-extrabold">{guide.faqTitle}</h2>
            <div className="mt-5 grid gap-3">
              {guide.faq.map((f) => (
                <details key={f.q} className="group rounded-[var(--r)] border border-line bg-surface">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold">
                    {f.q}
                    <CaretDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="px-5 pb-5 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="gingham rounded-[var(--r)] p-3">
            <div className="grid justify-items-start gap-4 rounded-[calc(var(--r)-4px)] bg-surface p-8">
              <p className="font-display text-3xl font-extrabold">Ready for the first one?</p>
              <Link to="/add" className="btn btn-primary btn-lg"><Plus size={20} weight="bold" /> {t.nav.add}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
