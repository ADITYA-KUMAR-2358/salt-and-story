import { CheckCircle, Info } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { loadGoogleScript, useAuth } from "../auth";
import { LogoMark } from "../components/Brand";
import Img from "../components/Img";
import { useTitle } from "../hooks";
import { t } from "../strings";

/** Only follow same-site paths after sign-in (never an attacker's absolute URL). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/recipes";
  return raw;
}

export default function SignIn() {
  useTitle(t.signin.title);
  const { state, signIn } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = state.status !== "loading" && "config" in state ? state.config : null;

  useEffect(() => {
    if (!config || config.mode !== "google" || !config.google_client_id || state.status === "signed-in") return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !button.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: config.google_client_id,
          ux_mode: "popup",
          context: "signin",
          callback: async ({ credential }) => {
            setBusy(true);
            setError(null);
            try { await signIn(credential); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
          },
        });
        const width = Math.min(360, button.current.offsetWidth || 320);
        window.google.accounts.id.renderButton(button.current, {
          type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "left", width,
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [config, signIn, state.status]);

  if (state.status === "signed-in") return <Navigate to={next} replace />;

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:py-14">
      <div className="grid max-w-xl gap-6">
        <LogoMark size={56} />
        <h1 className="font-display text-[clamp(2.4rem,6vw,3.8rem)] leading-[1.02] font-extrabold">{t.signin.title}</h1>
        <p className="text-lg text-muted">{t.signin.lead}</p>

        <ul className="grid gap-2.5">
          {t.signin.points.map((p) => (
            <li key={p} className="flex gap-3">
              <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        {state.status === "loading" && <div className="skeleton h-12 w-80 max-w-full rounded-full" aria-label="Loading" />}

        {config?.mode === "closed" && (
          <p role="alert" className="flex gap-3 rounded-[var(--r)] bg-accent-soft p-4">
            <Info size={22} className="mt-0.5 shrink-0" aria-hidden /> {t.signin.closed}
          </p>
        )}
        {state.status === "signed-out" && !config && (
          <p role="alert" className="rounded-[var(--r)] border border-danger bg-danger-soft p-4">{state.error}</p>
        )}

        {config?.mode === "google" && (
          <div className="grid gap-3">
            <div ref={button} className="min-h-11 w-full max-w-[360px]" aria-busy={busy} />
            {busy && <p className="text-sm font-semibold text-muted" role="status">{t.signin.busy}</p>}
            {error && <p role="alert" className="rounded-[var(--r)] border border-danger bg-danger-soft p-3 font-semibold">{error}</p>}
            <p className="text-sm text-muted">{t.signin.newHere}</p>
          </div>
        )}

        <p className="text-sm text-muted">
          {t.signin.agree}{" "}
          <Link to="/terms" className="font-semibold text-primary underline">{t.footer.terms}</Link>{" "}
          {t.signin.and}{" "}
          <Link to="/privacy" className="font-semibold text-primary underline">{t.footer.privacy}</Link>.
        </p>
      </div>

      <figure className="relative mx-auto hidden w-full max-w-md lg:block" aria-hidden="true">
        <Img src="/images/crepes-1280.webp" alt="" frame="lift aspect-[4/5] rounded-[var(--r)] border-[6px] border-surface" />
        <figcaption className="index-card lift absolute -bottom-8 -left-10 w-[78%] -rotate-2 px-5 pt-3 pb-5">
          <span className="flex h-8 items-center text-sm font-semibold text-muted">Mamie Odile, crêpes</span>
          <span className="font-hand mt-4 block text-[1.6rem] leading-8">&ldquo;Let it rest an hour, it must rest, like a person after lunch.&rdquo;</span>
        </figcaption>
      </figure>
    </section>
  );
}
