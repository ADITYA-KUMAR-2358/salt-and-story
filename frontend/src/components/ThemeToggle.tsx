import { Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { t } from "../strings";

type Theme = "light" | "dark";
const KEY = "salt-and-story:theme";
const THEME_COLOR: Record<Theme, string> = { light: "#2E6B4C", dark: "#10201A" };

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function currentTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  return set === "light" || set === "dark" ? set : systemTheme();
}
function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Light / dark switch. Follows the device until the reader chooses, then remembers it.
 * Where supported, the new theme spreads out in a circle from the button.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === "undefined" ? "light" : currentTheme()));
  const button = useRef<HTMLButtonElement>(null);

  // Keep following the device while the reader has not chosen.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
      if (!saved) setTheme(systemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch { /* private mode: still switch for this visit */ }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || reduce) {
      apply(next);
      setTheme(next);
      return;
    }
    const r = button.current?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : window.innerWidth - 40;
    const y = r ? r.top + r.height / 2 : 40;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = doc.startViewTransition(() => { apply(next); setTheme(next); });
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.16,1,.3,1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => undefined);
  }

  const label = theme === "dark" ? t.nav.toLight : t.nav.toDark;
  return (
    <button ref={button} type="button" onClick={toggle} aria-label={label} title={label} className="btn btn-ghost btn-icon">
      {theme === "dark" ? <Sun size={22} weight="bold" /> : <Moon size={22} weight="bold" />}
    </button>
  );
}
