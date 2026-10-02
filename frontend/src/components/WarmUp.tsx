import { ArrowClockwise, CircleNotch, WifiSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { t } from "../strings";

const FIVE_MIN = 5 * 60 * 1000;

/**
 * Pings /health on load (and every 5 minutes while open) so the free Render
 * backend wakes up. If waking takes longer than 3 seconds, a solid, high-contrast
 * bar says so, counts the seconds, and offers to try again. Same colours in
 * light and dark mode so it is always readable. Also reports when the device is offline.
 */
export default function WarmUp() {
  const [waking, setWaking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const attempt = useRef(0);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const ping = useCallback(async () => {
    const mine = ++attempt.current;
    const slow = window.setTimeout(() => { if (attempt.current === mine) setWaking(true); }, 3000);
    while (attempt.current === mine) {
      try {
        const ctl = new AbortController();
        const abort = window.setTimeout(() => ctl.abort(), 60000);
        const res = await api.health(ctl.signal);
        window.clearTimeout(abort);
        if (res.ok) break;
      } catch { /* keep retrying */ }
      await new Promise((r) => setTimeout(r, 4000));
    }
    window.clearTimeout(slow);
    if (attempt.current === mine) { setWaking(false); setSeconds(0); }
  }, []);

  useEffect(() => {
    ping();
    const every = window.setInterval(() => api.health().catch(() => undefined), FIVE_MIN);
    return () => { attempt.current++; window.clearInterval(every); };
  }, [ping]);

  useEffect(() => {
    if (!waking) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [waking]);

  if (offline) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 bg-[#fbe3dc] px-4 py-2.5 text-center text-sm font-semibold text-[#5a1a10]">
        <WifiSlash size={18} weight="bold" aria-hidden /> {t.warm.offline}
      </div>
    );
  }
  if (!waking) return null;
  const elapsed = seconds + 3;
  return (
    <div role="status" className="bg-[#f5b83d] text-[#1d3529]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-sm font-semibold sm:justify-between">
        <span className="flex items-center gap-2">
          <CircleNotch size={18} weight="bold" className="shrink-0 motion-safe:animate-spin" aria-hidden />
          {elapsed > 60 ? t.warm.slow : t.warm.banner}
        </span>
        <span className="flex items-center gap-3">
          <span className="tabular-nums" aria-hidden>{elapsed}s</span>
          <button type="button" onClick={() => { setSeconds(0); ping(); }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#1d3529] px-3 text-[#fffdf8] hover:bg-[#2e6b4c]">
            <ArrowClockwise size={14} weight="bold" aria-hidden /> {t.warm.retry}
          </button>
        </span>
      </div>
    </div>
  );
}
