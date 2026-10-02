import { GithubLogo, Heart, List, Plus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { t } from "../strings";
import { LogoMark } from "./Brand";
import ThemeToggle from "./ThemeToggle";
import WarmUp from "./WarmUp";

const LINKS = [
  { to: "/recipes", label: t.nav.library },
  { to: "/book", label: t.nav.book },
  { to: "/guide", label: t.nav.guide },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 font-semibold whitespace-nowrap transition-colors ${
    isActive ? "bg-surface text-primary lift" : "text-muted hover:text-ink hover:bg-surface/60"
  }`;

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-full pr-2" aria-label={`${t.appName}, home`}>
          <LogoMark size={40} />
          <span className="hidden font-display text-xl font-extrabold tracking-tight whitespace-nowrap min-[360px]:inline">{t.appName}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>)}
          <ThemeToggle />
          <Link to="/add" className="btn btn-primary ml-1"><Plus size={18} weight="bold" /> {t.nav.add}</Link>
        </nav>

        <div className="flex items-center gap-1.5 md:hidden">
          <ThemeToggle />
          <Link to="/add" className="btn btn-primary btn-icon" aria-label={t.nav.add}><Plus size={20} weight="bold" /></Link>
          <button className="btn btn-icon" aria-expanded={open} aria-controls="mobile-nav"
            aria-label={open ? t.nav.close : t.nav.menu} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="pop lift absolute inset-x-4 top-full grid gap-1 rounded-[var(--r)] border border-line bg-surface p-2 md:hidden">
          <NavLink to="/" end className={linkClass}>{t.nav.home}</NavLink>
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>)}
        </nav>
      )}
    </header>
  );
}

const FOOTER_GROUPS = [
  { id: "make", title: t.footer.make, links: [
    { to: "/add", label: t.nav.add }, { to: "/recipes", label: t.nav.library }, { to: "/book", label: t.nav.book },
  ] },
  { id: "help", title: t.footer.help, links: [
    { to: "/guide", label: t.nav.guide }, { to: "/guide#faq", label: t.footer.faq }, { to: "/accessibility", label: t.footer.accessibility },
  ] },
  { id: "about", title: t.footer.about, links: [
    { to: "/privacy", label: t.footer.privacy }, { to: "/terms", label: t.footer.terms }, { to: "/credits", label: t.footer.credits },
  ] },
];

function Footer() {
  return (
    <footer className="mt-24">
      <div className="gingham h-5" aria-hidden="true" />
      <div className="bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 grid content-start gap-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <LogoMark size={36} />
              <span className="font-display text-lg font-extrabold">{t.appName}</span>
            </div>
            <p className="font-hand text-2xl text-muted">{t.tagline}</p>
            <p className="max-w-[44ch] text-sm text-muted">{t.footer.built}</p>
          </div>
          {FOOTER_GROUPS.map((g) => (
            <nav key={g.title} aria-labelledby={`f-${g.id}`} className="grid content-start gap-2.5">
              <h2 id={`f-${g.id}`} className="font-display text-base font-bold">{g.title}</h2>
              {g.links.map((l) => (
                <Link key={l.to} className="w-fit text-muted hover:text-primary hover:underline" to={l.to}>{l.label}</Link>
              ))}
            </nav>
          ))}
          <p className="col-span-2 max-w-[60ch] text-sm text-muted md:col-span-4">{t.footer.fictional}</p>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <p className="flex items-center gap-2">
              <span className="font-hand text-[1.7rem] leading-none text-ink">{t.footer.signature}</span>
              <Heart size={18} weight="fill" className="text-accent" aria-hidden />
            </p>
            <a href={t.footer.githubUrl} target="_blank" rel="noopener noreferrer" className="btn"
              aria-label={`${t.footer.github} (opens in a new tab)`}>
              <GithubLogo size={20} weight="fill" /> {t.footer.github}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a href="#main" className="skip-link btn btn-primary">{t.skip}</a>
      <WarmUp />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
