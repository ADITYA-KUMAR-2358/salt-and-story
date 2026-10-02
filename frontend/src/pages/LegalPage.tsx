import { Link } from "react-router-dom";
import type { LegalDoc } from "../content/legal";
import { useTitle } from "../hooks";

/** Privacy, Terms and Accessibility share one calm, readable layout. */
export default function LegalPage({ doc }: { doc: LegalDoc }) {
  useTitle(doc.title);
  const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-5xl font-extrabold">{doc.title}</h1>
        <p className="mt-2 text-sm font-semibold text-muted">Last updated {doc.updated}</p>
        <p className="mt-5 text-xl leading-relaxed text-muted">{doc.lead}</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-6 grid gap-1">
            <p className="mb-2 font-semibold text-muted">On this page</p>
            {doc.sections.map((s) => (
              <a key={s.heading} href={`#${slug(s.heading)}`} className="rounded-full px-4 py-2 font-semibold text-muted hover:bg-surface hover:text-ink">
                {s.heading}
              </a>
            ))}
          </div>
        </nav>

        <div className="grid max-w-[68ch] gap-10">
          {doc.sections.map((s) => (
            <section key={s.heading} id={slug(s.heading)} aria-labelledby={`${slug(s.heading)}-h`} className="scroll-mt-6">
              <h2 id={`${slug(s.heading)}-h`} className="font-display text-2xl font-extrabold">{s.heading}</h2>
              <div className="mt-3 grid gap-3 text-[1.04rem] leading-relaxed">
                {s.body.map((para) => <p key={para}>{para}</p>)}
              </div>
            </section>
          ))}
          <p className="rounded-[var(--r)] bg-surface p-5 text-sm text-muted">
            Plain-language summary of how this app works, not legal advice. See also the{" "}
            <Link to="/privacy" className="font-semibold text-primary underline">Privacy</Link>,{" "}
            <Link to="/terms" className="font-semibold text-primary underline">Terms of use</Link> and{" "}
            <Link to="/accessibility" className="font-semibold text-primary underline">Accessibility</Link> pages.
          </p>
        </div>
      </div>
    </article>
  );
}
