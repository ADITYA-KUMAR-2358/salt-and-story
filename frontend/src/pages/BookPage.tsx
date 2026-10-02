import { ArrowDown, ArrowUp, BookOpen, DotsSixVertical, DownloadSimple, Heart, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, media, type Recipe } from "../api";
import { BookIllustration } from "../components/Brand";
import Img from "../components/Img";
import { useTitle } from "../hooks";
import { t } from "../strings";

const STORE = "salt-and-story:book";

function loadPrefs(): { title: string; dedication: string; order: number[] } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "{}");
    return { title: v.title ?? t.appName, dedication: v.dedication ?? "", order: Array.isArray(v.order) ? v.order : [] };
  } catch { return { title: t.appName, dedication: "", order: [] }; }
}

/** A live HTML twin of the PDF cover, so choices are visible before building. */
function CoverPreview({ title, dedication, speakers }: { title: string; dedication: string; speakers: string[] }) {
  const names = speakers.length <= 2 ? speakers.join(" and ") : `${speakers.slice(0, -1).join(", ")} and ${speakers.at(-1)}`;
  return (
    <div className="lift mx-auto aspect-[148/210] w-full max-w-[19rem] overflow-hidden rounded-[10px] bg-[#2e6b4c] text-[#f6fbf2]" aria-label="Cover preview" role="img">
      <div className="gingham h-[12%]" />
      <div className="grid gap-3 px-[9%] pt-[16%]">
        <p className="font-display text-[clamp(1.4rem,3.4vw,2rem)] leading-[1.05] font-extrabold break-words">{title || t.appName}</p>
        <p className="text-sm text-[#d6ead9] italic">{t.tagline}</p>
        {names && <p className="mt-[18%] text-xs text-[#d6ead9]">Recipes told by {names}</p>}
        {dedication && <p className="font-hand text-2xl text-[#f5b83d]">For {dedication}</p>}
      </div>
    </div>
  );
}

export default function BookPage() {
  useTitle(t.book.title);
  const prefs = useMemo(loadPrefs, []);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [order, setOrder] = useState<number[]>(prefs.order);
  const [title, setTitle] = useState(prefs.title);
  const [dedication, setDedication] = useState(prefs.dedication);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    api.list().then((all) => {
      const ready = all.filter((r) => r.status === "ready");
      setRecipes(ready);
      setOrder((o) => o.filter((id) => ready.some((r) => r.id === id))); // drop deleted ones
    }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ title, dedication, order })); } catch { /* private mode */ }
  }, [title, dedication, order]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // Any change makes the built PDF stale.
  useEffect(() => { setUrl(null); }, [order, title, dedication]);

  const byId = new Map((recipes ?? []).map((r) => [r.id, r]));
  const speakers = [...new Set(order.map((id) => byId.get(id)?.speaker_name).filter(Boolean) as string[])].sort();
  const toggle = (id: number) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const move = (i: number, d: number) => setOrder((o) => {
    const j = i + d;
    if (j < 0 || j >= o.length) return o;
    const next = [...o];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const dropOn = (to: number) => {
    if (dragging === null) return;
    setOrder((o) => { const next = o.filter((x) => x !== dragging); next.splice(to, 0, dragging); return next; });
    setDragging(null);
  };

  async function build() {
    if (order.length === 0) return setError(t.book.needOne);
    setBusy(true);
    setError(null);
    try { setUrl(URL.createObjectURL(await api.bookBlob(order, title.trim() || t.appName, dedication.trim()))); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">{t.book.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">{t.book.lead}</p>

      {error && !recipes && <p role="alert" className="mt-6 rounded-[var(--r)] border border-danger bg-danger-soft p-4">{error}</p>}
      {recipes === null && !error && <div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="skeleton h-80" /><div className="skeleton h-80" /></div>}

      {recipes?.length === 0 && (
        <div className="gingham-sage mt-8 grid items-center gap-6 rounded-[var(--r)] p-8 md:grid-cols-[auto_1fr]">
          <BookIllustration className="size-32 text-ink" />
          <div className="grid justify-items-start gap-3">
            <p className="text-lg">{t.book.none}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/add" className="btn btn-primary"><Plus size={18} weight="bold" /> {t.nav.add}</Link>
              <Link to="/recipes" className="btn">{t.nav.library}</Link>
            </div>
          </div>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-10">
            <fieldset>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <legend className="font-display text-2xl font-extrabold">{t.book.pick}</legend>
                <div className="flex gap-1">
                  {recipes.some((r) => r.favorite) && (
                    <button type="button" className="btn btn-ghost !min-h-10"
                      onClick={() => setOrder(recipes.filter((r) => r.favorite).map((r) => r.id))}>
                      <Heart size={16} weight="fill" className="text-primary" /> {t.book.selectFavs}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost !min-h-10" onClick={() => setOrder(recipes.map((r) => r.id))}>{t.book.selectAll}</button>
                  <button type="button" className="btn btn-ghost !min-h-10" onClick={() => setOrder([])} disabled={!order.length}>{t.book.clear}</button>
                </div>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recipes.map((r) => {
                  const on = order.includes(r.id);
                  const photo = media(r.photo_url);
                  return (
                    <li key={r.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-[var(--r)] border-2 p-2 pr-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                        on ? "border-primary bg-surface" : "border-line hover:bg-surface"}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(r.id)} />
                        {photo ? <Img src={photo} alt="" frame="size-14 shrink-0 rounded-xl" />
                          : <span className="gingham size-14 shrink-0 rounded-xl" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <span className="truncate">{r.title}</span>
                            {r.favorite && <Heart size={14} weight="fill" className="shrink-0 text-primary" aria-label="Favourite" />}
                          </span>
                          {r.speaker_name && <span className="block truncate text-sm text-muted">{r.speaker_name}</span>}
                        </span>
                        <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-primary bg-primary text-on-primary" : "border-line"}`} aria-hidden>
                          {on && <span className="text-xs font-bold">{order.indexOf(r.id) + 1}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-sm text-muted" aria-live="polite">{t.book.picked(order.length)}</p>
            </fieldset>

            {order.length > 1 && (
              <div>
                <h2 className="font-display text-2xl font-extrabold">{t.book.order}</h2>
                <p className="hint mb-3">{t.book.orderHint}</p>
                <ol className="grid gap-2">
                  {order.map((id, i) => (
                    <li key={id} draggable onDragStart={() => setDragging(id)} onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(i)}
                      className={`flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3 transition-opacity ${dragging === id ? "opacity-40" : ""}`}>
                      <DotsSixVertical size={20} className="cursor-grab text-muted" aria-hidden />
                      <span className="w-6 font-display font-bold text-primary">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{byId.get(id)?.title}</span>
                      <button className="btn btn-ghost btn-icon !min-h-10 !w-10" aria-label={`${t.recipe.moveUp}: ${byId.get(id)?.title}`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={16} /></button>
                      <button className="btn btn-ghost btn-icon !min-h-10 !w-10" aria-label={`${t.recipe.moveDown}: ${byId.get(id)?.title}`} onClick={() => move(i, 1)} disabled={i === order.length - 1}><ArrowDown size={16} /></button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="bt" className="label">{t.book.bookTitle}</label>
                <input id="bt" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="bd" className="label">{t.book.dedication}</label>
                <input id="bd" className="input" value={dedication} maxLength={200} placeholder={t.book.dedicationPlaceholder}
                  onChange={(e) => setDedication(e.target.value)} aria-describedby="bd-h" />
                <p id="bd-h" className="hint">{t.book.dedicationHint}</p>
              </div>
            </div>
          </div>

          <div className="grid content-start gap-6 lg:sticky lg:top-6">
            <div className="gingham-sage grid gap-5 rounded-[var(--r)] p-6 sm:p-8">
              <p className="text-center font-semibold text-muted">{t.book.cover}</p>
              <CoverPreview title={title} dedication={dedication} speakers={speakers} />
              <p className="text-center text-sm text-muted">{t.book.pages}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-primary btn-lg" onClick={build} disabled={busy || order.length === 0}>
                <BookOpen size={20} weight="fill" /> {busy ? t.book.building : url ? t.book.rebuild : t.book.preview}
              </button>
              {url && <a className="btn btn-lg pop" href={url} download={`${(title || "salt-and-story").replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`}><DownloadSimple size={20} /> {t.book.download}</a>}
            </div>
            {error && <p role="alert" className="rounded-[var(--r)] border border-danger bg-danger-soft p-4 font-semibold">{error}</p>}
            {url && (
              <div className="pop overflow-hidden rounded-[var(--r)] border border-line bg-surface">
                <p className="px-4 py-3 font-semibold">{t.book.ready}</p>
                <iframe title="Book preview" src={url} className="h-[36rem] w-full border-t border-line" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
