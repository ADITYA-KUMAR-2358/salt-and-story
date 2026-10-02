import {
  ArrowCounterClockwise, ArrowDown, ArrowLeft, ArrowUp, Camera, ChefHat, DotsThreeVertical, DownloadSimple, Heart,
  PencilSimple, Plus, Quotes, SpeakerHigh, Trash, X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, IN_PROGRESS, media, type Recipe, type RecipeDraft } from "../api";
import { useCapabilities } from "../components/Capabilities";
import ConfirmDialog from "../components/ConfirmDialog";
import CookMode from "../components/CookMode";
import Img from "../components/Img";
import Stepper from "../components/Stepper";
import { useToast } from "../components/Toast";
import { useRecipePoll, useTitle } from "../hooks";
import { t } from "../strings";
import NotFound from "./NotFound";

const toDraft = (r: Recipe): RecipeDraft => ({
  title: r.title, story: r.story, servings: r.servings, prep_time: r.prep_time, cook_time: r.cook_time,
  ingredients: r.ingredients.map((i) => ({ ...i })), steps: [...r.steps], tips: [...r.tips],
  quote: r.quote, speaker_name: r.speaker_name,
});

// ---------------------------------------------------------------- photo

function PhotoPanel({ recipe, onChange }: { recipe: Recipe; onChange: (r: Recipe) => void }) {
  const toast = useToast();
  const { caps } = useCapabilities();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const photo = media(recipe.photo_url);
  const maxMb = caps?.max_photo_mb ?? 10;

  async function upload(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Choose a photo (JPEG, PNG or WebP).");
    if (f.size > maxMb * 1024 * 1024) return toast.error(`That photo is over ${maxMb} MB.`);
    setBusy(true);
    try { onChange(await api.uploadPhoto(recipe.id, f, f.name)); toast.success(t.recipe.photo.added); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function remove() {
    setBusy(true);
    try { onChange(await api.deletePhoto(recipe.id)); toast.success(t.recipe.photo.removed); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const picker = (
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
      onChange={(e) => upload(e.target.files?.[0])} />
  );

  if (!photo) {
    return (
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
        className="gingham group grid aspect-[4/3] w-full place-items-center rounded-[var(--r)] p-4">
        <span className="lift grid justify-items-center gap-2 rounded-[var(--r)] bg-surface px-6 py-5 text-center transition-transform group-hover:-translate-y-0.5">
          <Camera size={30} className="text-primary" aria-hidden />
          <span className="font-semibold">{busy ? t.recipe.photo.uploading : t.recipe.photo.add}</span>
          <span className="max-w-[26ch] text-sm text-muted">{t.recipe.photo.hint}</span>
        </span>
        {picker}
      </button>
    );
  }
  return (
    <div className="grid gap-3">
      <Img key={photo} src={photo} alt={recipe.title} eager frame={`lift aspect-[4/3] w-full rounded-[var(--r)] transition-opacity ${busy ? "opacity-60" : ""}`} />
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}><Camera size={18} /> {busy ? t.recipe.photo.uploading : t.recipe.photo.replace}</button>
        <button className="btn btn-ghost" onClick={remove} disabled={busy}>{t.recipe.photo.remove}</button>
      </div>
      {picker}
    </div>
  );
}

// ---------------------------------------------------------------- read view

function ReadView({ recipe }: { recipe: Recipe }) {
  const [gotIng, setGotIng] = useState<Set<number>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);
  const toggle = (set: Set<number>, n: number) => { const s = new Set(set); if (s.has(n)) s.delete(n); else s.add(n); return s; };

  return (
    <>
      {recipe.quote && (
        <figure className="index-card lift relative mt-12 px-6 pt-3 pb-7 sm:px-10">
          <figcaption className="flex h-9 items-center gap-2 font-semibold text-muted">
            <Quotes size={20} weight="fill" className="text-accent" aria-hidden /> {t.recipe.quote}
          </figcaption>
          <blockquote className="font-hand mt-6 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.15]">&ldquo;{recipe.quote}&rdquo;</blockquote>
          {recipe.speaker_name && <p className="mt-3 font-semibold text-muted">{recipe.speaker_name}</p>}
        </figure>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section aria-labelledby="ing-h">
          <h2 id="ing-h" className="font-display text-3xl font-extrabold">{t.recipe.ingredients}</h2>
          {recipe.ingredients.length === 0 ? <p className="mt-3 text-muted">None listed yet.</p> : (
            <ul className="mt-4 grid gap-1">
              {recipe.ingredients.map((i, n) => (
                <li key={n} className="check-row" data-done={gotIng.has(n)}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-surface">
                    <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--primary)]" checked={gotIng.has(n)}
                      onChange={() => setGotIng((s) => toggle(s, n))} />
                    <span className="check-text">
                      {i.quantity && <strong>{i.quantity} </strong>}{i.name}
                      {i.note && <span className="text-muted"> ({i.note})</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="steps-h">
          <h2 id="steps-h" className="font-display text-3xl font-extrabold">{t.recipe.steps}</h2>
          {recipe.steps.length === 0 ? <p className="mt-3 text-muted">No steps yet.</p> : (
            <ol className="mt-4 grid gap-2">
              {recipe.steps.map((s, n) => (
                <li key={n} className="check-row" data-done={doneSteps.has(n)}>
                  <button type="button" aria-pressed={doneSteps.has(n)} onClick={() => setDoneSteps((d) => toggle(d, n))}
                    className="flex w-full items-start gap-4 rounded-xl px-2 py-3 text-left hover:bg-surface">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-bold transition-colors ${
                      doneSteps.has(n) ? "bg-primary text-on-primary" : "bg-accent-soft text-ink"}`}>{n + 1}</span>
                    <span className="check-text pt-1 text-[1.06rem]">{s}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {recipe.tips.length > 0 && (
            <aside className="gingham-sage mt-8 rounded-[var(--r)] p-1.5">
              <div className="rounded-[calc(var(--r)-4px)] bg-surface p-5">
                <h3 className="font-display text-xl font-bold">{t.recipe.tips}</h3>
                <ul className="mt-2 grid list-disc gap-1.5 pl-5 marker:text-accent">
                  {recipe.tips.map((tip, n) => <li key={n}>{tip}</li>)}
                </ul>
              </div>
            </aside>
          )}
        </section>
      </div>

      {recipe.transcript && (
        <section className="mt-12 border-t border-line pt-6">
          <button className="btn" aria-expanded={showTranscript} onClick={() => setShowTranscript((s) => !s)}>
            {showTranscript ? t.recipe.hideTranscript : t.recipe.showTranscript}
          </button>
          {showTranscript && (
            <div className="fade-up mt-4 max-w-3xl rounded-[var(--r)] bg-surface p-6">
              <h3 className="mb-2 font-display text-lg font-bold">{t.recipe.transcript}</h3>
              <p className="leading-relaxed whitespace-pre-wrap text-muted">{recipe.transcript}</p>
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------- edit view

function Text({ id, label, value, onChange, area, hint, invalid }:
  { id: string; label: string; value: string; onChange: (v: string) => void; area?: boolean; hint?: string; invalid?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      {area
        ? <textarea id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} />
        : <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} aria-describedby={hint ? `${id}-h` : undefined} />}
      {hint && <p id={`${id}-h`} className="hint">{hint}</p>}
    </div>
  );
}

function EditView({ draft, set }: { draft: RecipeDraft; set: <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => void }) {
  const setIng = (i: number, patch: Partial<RecipeDraft["ingredients"][number]>) =>
    set("ingredients", draft.ingredients.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const setList = (k: "steps" | "tips", i: number, v: string) => set(k, draft[k].map((x, n) => (n === i ? v : x)));
  const move = (k: "steps" | "tips", i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= draft[k].length) return;
    const next = [...draft[k]];
    [next[i], next[j]] = [next[j], next[i]];
    set(k, next);
  };

  return (
    <div className="mt-8 grid max-w-3xl gap-10">
      <Text id="f-title" label={t.recipe.title} value={draft.title} onChange={(v) => set("title", v)} invalid={!draft.title.trim()}
        hint={!draft.title.trim() ? t.recipe.titleRequired : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text id="f-speaker" label={t.recipe.speaker} value={draft.speaker_name ?? ""} onChange={(v) => set("speaker_name", v || null)} />
        <Text id="f-serves" label={t.recipe.servings} value={draft.servings ?? ""} onChange={(v) => set("servings", v || null)} />
        <Text id="f-prep" label={t.recipe.prep} value={draft.prep_time ?? ""} onChange={(v) => set("prep_time", v || null)} />
        <Text id="f-cook" label={t.recipe.cookTime} value={draft.cook_time ?? ""} onChange={(v) => set("cook_time", v || null)} />
      </div>
      <Text id="f-story" area label={t.recipe.story} hint={t.recipe.storyHint} value={draft.story} onChange={(v) => set("story", v)} />
      <Text id="f-quote" area label={t.recipe.quote} hint={t.recipe.quoteHint} value={draft.quote} onChange={(v) => set("quote", v)} />

      <fieldset className="grid gap-3">
        <legend className="mb-2 font-display text-2xl font-extrabold">{t.recipe.ingredients}</legend>
        {draft.ingredients.map((ing, i) => (
          <div key={i} className="grid grid-cols-[6.5rem_1fr_auto] items-end gap-2 rounded-[var(--r)] bg-surface p-3 sm:grid-cols-[7.5rem_1fr_1fr_auto]">
            <div className="field"><label className="label" htmlFor={`q${i}`}>{t.recipe.qty}</label>
              <input id={`q${i}`} className="input" value={ing.quantity ?? ""} onChange={(e) => setIng(i, { quantity: e.target.value || null })} /></div>
            <div className="field"><label className="label" htmlFor={`n${i}`}>{t.recipe.ing}</label>
              <input id={`n${i}`} className="input" value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} /></div>
            <div className="field col-span-2 col-start-1 sm:col-span-1 sm:col-start-auto"><label className="label" htmlFor={`o${i}`}>{t.recipe.note}</label>
              <input id={`o${i}`} className="input" value={ing.note ?? ""} onChange={(e) => setIng(i, { note: e.target.value || null })} /></div>
            <button type="button" className="btn btn-ghost btn-icon" aria-label={`${t.recipe.remove} ${ing.name || t.recipe.ing}`}
              onClick={() => set("ingredients", draft.ingredients.filter((_, n) => n !== i))}><X size={18} /></button>
          </div>
        ))}
        <button type="button" className="btn w-fit" onClick={() => set("ingredients", [...draft.ingredients, { name: "", quantity: null, note: null }])}>
          <Plus size={18} /> {t.recipe.addIng}
        </button>
      </fieldset>

      {(["steps", "tips"] as const).map((k) => (
        <fieldset key={k} className="grid gap-3">
          <legend className="mb-2 font-display text-2xl font-extrabold">{k === "steps" ? t.recipe.steps : t.recipe.tips}</legend>
          {draft[k].map((v, i) => {
            const label = k === "steps" ? t.recipe.step(i + 1) : t.recipe.tip(i + 1);
            return (
              <div key={i} className="flex items-start gap-2">
                {k === "steps" && <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-display font-bold" aria-hidden>{i + 1}</span>}
                <textarea className="input !min-h-16" aria-label={label} value={v} onChange={(e) => setList(k, i, e.target.value)} />
                <div className="grid gap-1">
                  <button type="button" className="btn btn-ghost btn-icon !min-h-10 !w-10" aria-label={`${t.recipe.moveUp}: ${label}`} disabled={i === 0} onClick={() => move(k, i, -1)}><ArrowUp size={16} /></button>
                  <button type="button" className="btn btn-ghost btn-icon !min-h-10 !w-10" aria-label={`${t.recipe.moveDown}: ${label}`} disabled={i === draft[k].length - 1} onClick={() => move(k, i, 1)}><ArrowDown size={16} /></button>
                </div>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`${t.recipe.remove}: ${label}`}
                  onClick={() => set(k, draft[k].filter((_, n) => n !== i))}><X size={18} /></button>
              </div>
            );
          })}
          <button type="button" className="btn w-fit" onClick={() => set(k, [...draft[k], ""])}>
            <Plus size={18} /> {k === "steps" ? t.recipe.addStep : t.recipe.addTip}
          </button>
        </fieldset>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function RecipePage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const toast = useToast();
  const { caps } = useCapabilities();
  const [params, setParams] = useSearchParams();
  const editing = params.get("edit") === "1";
  const [bump, setBump] = useState(0);
  const { recipe, setRecipe, error } = useRecipePoll(Number.isNaN(id) ? null : id, bump);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "rewrite">(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useTitle(recipe?.title ?? "Recipe");

  const working = !!recipe && IN_PROGRESS.includes(recipe.status);

  useEffect(() => { if (recipe && !working && !dirty) setDraft(toDraft(recipe)); }, [recipe, working, dirty]);
  useEffect(() => { setAudioUrl(media(recipe?.narration_url ?? null)); }, [recipe?.narration_url]);

  // Warn before losing edits: in-app navigation and tab close.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menu]);

  if (Number.isNaN(id) || error?.status === 404) return <NotFound />;
  if (error && !recipe) {
    return (
      <div className="mx-auto grid max-w-xl justify-items-start gap-3 px-4 py-16">
        <p role="alert" className="text-lg">{error.message}</p>
        <button className="btn" onClick={() => setBump((n) => n + 1)}>{t.library.retry}</button>
      </div>
    );
  }
  if (!recipe) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading recipe">
        <div className="grid content-start gap-4"><div className="skeleton h-14 w-3/4" /><div className="skeleton h-6 w-1/3" /><div className="skeleton h-24" /></div>
        <div className="skeleton aspect-[4/3]" />
      </div>
    );
  }

  if (working) {
    return (
      <div className="mx-auto grid max-w-xl gap-6 px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold">{t.add.progressTitle}</h1>
        <p className="text-muted">{t.add.progressHint}</p>
        <div aria-live="polite"><Stepper status={recipe.status} hasAudio={recipe.has_audio} /></div>
      </div>
    );
  }

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setDirty(true);
  };
  const setEditing = (on: boolean) => setParams(on ? { edit: "1" } : {}, { replace: true });

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error(t.recipe.titleRequired);
    setSaving(true);
    try {
      const saved = await api.update(id, draft);
      setRecipe(saved);
      setDirty(false);
      setEditing(false);
      toast.success(t.recipe.saved);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }
  function discard() {
    if (recipe) setDraft(toDraft(recipe));
    setDirty(false);
    setEditing(false);
  }
  async function toggleFavorite() {
    if (!recipe) return;
    const want = !recipe.favorite;
    setRecipe({ ...recipe, favorite: want });
    try {
      setRecipe(await api.setFavorite(id, want));
      toast.success(want ? t.fav.added : t.fav.removed);
    } catch (e) {
      setRecipe({ ...recipe, favorite: !want });
      toast.error((e as Error).message);
    }
  }

  async function narrate() {
    if (audioUrl) return;
    setNarrating(true);
    try { const { url } = await api.narrate(id); setAudioUrl(`${media(url)}?v=${Date.now()}`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setNarrating(false); }
  }
  async function rewrite() {
    setConfirm(null);
    try { await api.restructure(id); setDirty(false); setEditing(false); setBump((n) => n + 1); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove() {
    setConfirm(null);
    try { setDirty(false); await api.remove(id); toast.success(t.recipe.deleted); nav("/recipes", { replace: true }); }
    catch (e) { toast.error((e as Error).message); }
  }

  const meta = [
    recipe.servings && t.recipe.serves(recipe.servings),
    recipe.prep_time && t.recipe.prepTime(recipe.prep_time),
    recipe.cook_time && t.recipe.cookTimeShort(recipe.cook_time),
  ].filter(Boolean) as string[];
  const canRewrite = !!recipe.transcript || recipe.has_audio;
  const canNarrate = caps ? caps.narration : true;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link to="/recipes" className="btn btn-ghost -ml-3"><ArrowLeft size={18} /> {t.recipe.back}</Link>

      {recipe.status === "failed" && (
        <div role="alert" className="mt-4 grid justify-items-start gap-3 rounded-[var(--r)] border border-danger bg-danger-soft p-5">
          <p className="font-display text-xl font-bold">{t.recipe.failed}</p>
          <p>{recipe.error}</p>
          <div className="flex flex-wrap gap-2">
            {canRewrite && <button className="btn btn-primary" onClick={rewrite}><ArrowCounterClockwise size={18} /> {t.add.retry}</button>}
            {!editing && <button className="btn" onClick={() => setEditing(true)}><PencilSimple size={18} /> {t.add.openAnyway}</button>}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid content-start gap-5">
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.5rem)] leading-[1.02] font-extrabold">{editing ? draft?.title || recipe.title : recipe.title}</h1>
          {recipe.speaker_name && <p className="text-lg"><span className="text-muted">{t.recipe.speaker} </span><strong>{recipe.speaker_name}</strong></p>}
          {meta.length > 0 && <div className="flex flex-wrap gap-2">{meta.map((m) => <span key={m} className="chip">{m}</span>)}</div>}
          {recipe.story && !editing && <p className="max-w-[60ch] text-lg leading-relaxed text-muted">{recipe.story}</p>}

          {!editing && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button className="btn btn-primary btn-lg" onClick={() => setCooking(true)} disabled={recipe.steps.length === 0}>
                <ChefHat size={22} weight="fill" /> {t.recipe.cook}
              </button>
              <button className="btn" onClick={toggleFavorite} aria-pressed={recipe.favorite}
                aria-label={recipe.favorite ? t.fav.remove(recipe.title) : t.fav.add(recipe.title)}>
                <Heart key={String(recipe.favorite)} size={18} weight={recipe.favorite ? "fill" : "bold"}
                  className={recipe.favorite ? "heart-pop text-primary" : ""} /> {t.fav.on}
              </button>
              <button className="btn" onClick={() => setEditing(true)}><PencilSimple size={18} /> {t.recipe.edit}</button>
              <button className="btn" onClick={narrate} disabled={!canNarrate || narrating || !!audioUrl}
                title={!canNarrate ? t.recipe.noNarration : undefined}>
                <SpeakerHigh size={18} /> {narrating ? t.recipe.narrating : t.recipe.narrate}
              </button>
              <div className="relative" ref={menuRef}>
                <button className="btn btn-icon" aria-label={t.recipe.more} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                  <DotsThreeVertical size={22} weight="bold" />
                </button>
                {menu && (
                  <div role="menu" className="pop lift absolute right-0 z-20 mt-2 grid w-64 gap-1 rounded-[var(--r)] border border-line bg-surface p-2 sm:left-0">
                    <a role="menuitem" className="btn btn-ghost !justify-start" href={api.pdfUrl(id)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>
                      <DownloadSimple size={18} /> {t.recipe.pdf}
                    </a>
                    {canRewrite && (
                      <button role="menuitem" className="btn btn-ghost !justify-start" onClick={() => { setMenu(false); setConfirm("rewrite"); }}>
                        <ArrowCounterClockwise size={18} /> {t.recipe.restructure}
                      </button>
                    )}
                    <button role="menuitem" className="btn btn-ghost btn-danger !justify-start" onClick={() => { setMenu(false); setConfirm("delete"); }}>
                      <Trash size={18} /> {t.recipe.del}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {audioUrl && !editing && <audio controls src={audioUrl} className="w-full max-w-md" autoPlay />}
          {!canNarrate && !editing && <p className="hint">{t.recipe.noNarration}</p>}
        </div>

        <PhotoPanel recipe={recipe} onChange={setRecipe} />
      </div>

      {editing && draft ? <EditView draft={draft} set={set} /> : <ReadView recipe={recipe} />}

      {editing && (
        <div className="sticky bottom-3 z-20 mt-10 flex flex-wrap items-center gap-3 rounded-full border border-line bg-surface/95 p-2 pl-5 lift backdrop-blur">
          <span className="mr-auto text-sm font-semibold text-muted">{dirty ? "Unsaved changes" : "No changes yet"}</span>
          <button className="btn btn-ghost" onClick={discard}>{dirty ? t.recipe.discard : t.recipe.done}</button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? t.recipe.saving : t.recipe.save}</button>
        </div>
      )}

      {cooking && <CookMode recipe={recipe} onClose={() => setCooking(false)} />}

      <ConfirmDialog open={confirm === "delete"} danger title={t.recipe.confirmDelTitle} body={t.recipe.confirmDelBody}
        confirmLabel={t.recipe.del} onConfirm={remove} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "rewrite"} title={t.recipe.confirmRewriteTitle} body={t.recipe.confirmRewriteBody}
        confirmLabel={t.recipe.restructure} onConfirm={rewrite} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={blocker.state === "blocked"} title={t.recipe.leaveTitle} body={t.recipe.leaveBody}
        confirmLabel={t.recipe.leave} cancelLabel={t.recipe.stay} danger
        onConfirm={() => blocker.proceed?.()} onCancel={() => blocker.reset?.()} />
    </div>
  );
}
