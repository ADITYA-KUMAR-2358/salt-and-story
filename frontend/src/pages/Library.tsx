import { DownloadSimple, Heart, MagnifyingGlass, Plus, UploadSimple, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, IN_PROGRESS, type Recipe } from "../api";
import { CardIllustration } from "../components/Brand";
import ClassicCard from "../components/ClassicCard";
import ConfirmDialog from "../components/ConfirmDialog";
import RecipeTile from "../components/RecipeTile";
import { useToast } from "../components/Toast";
import { CLASSICS } from "../classics";
import { useTitle } from "../hooks";
import { t } from "../strings";

export default function Library() {
  useTitle(t.library.title);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const onlyFavs = params.get("show") === "favourites";
  const [query, setQuery] = useState(q);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<Recipe | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.list(q).then(setRecipes).catch((e: Error) => setError(e.message));
  }, [q]);
  useEffect(load, [load]);

  // Debounce typing into the URL (shareable, back-button friendly).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (query !== q) {
        const next = new URLSearchParams(params);
        if (query) next.set("q", query); else next.delete("q");
        setParams(next, { replace: true });
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [query, q, params, setParams]);

  const setShow = (favs: boolean) => {
    const next = new URLSearchParams(params);
    if (favs) next.set("show", "favourites"); else next.delete("show");
    setParams(next, { replace: true });
  };

  /** Optimistic: the heart fills at once; if saving fails it flips back and says why. */
  async function toggleFavorite(r: Recipe) {
    const want = !r.favorite;
    setRecipes((list) => list?.map((x) => (x.id === r.id ? { ...x, favorite: want } : x)) ?? list);
    try {
      await api.setFavorite(r.id, want);
      toast.success(want ? t.fav.added : t.fav.removed);
    } catch (e) {
      setRecipes((list) => list?.map((x) => (x.id === r.id ? { ...x, favorite: !want } : x)) ?? list);
      toast.error((e as Error).message);
    }
  }

  async function confirmDelete() {
    const r = toDelete;
    setToDelete(null);
    if (!r) return;
    try {
      await api.remove(r.id);
      setRecipes((list) => list?.filter((x) => x.id !== r.id) ?? list);
      toast.success(t.recipe.deleted);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Keep refreshing while any memo is still being written.
  useEffect(() => {
    if (!recipes?.some((r) => IN_PROGRESS.includes(r.status))) return;
    const id = window.setTimeout(load, 3000);
    return () => window.clearTimeout(id);
  }, [recipes, load]);

  async function backup() {
    try {
      const data = await api.exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), {
        href: url, download: `salt-and-story-backup-${new Date().toISOString().slice(0, 10)}.json`,
      });
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.library.backedUp);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function restore(file: File) {
    try {
      const items = JSON.parse(await file.text());
      if (!Array.isArray(items) || items.some((x) => typeof x?.title !== "string")) throw new Error(t.library.restoreBad);
      const { imported } = await api.importAll(items);
      toast.success(t.library.restored(imported));
      load();
    } catch (e) {
      toast.error(e instanceof SyntaxError ? t.library.restoreBad : (e as Error).message);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const isEmpty = recipes?.length === 0 && !q;
  const favCount = recipes?.filter((r) => r.favorite).length ?? 0;
  const shown = onlyFavs ? recipes?.filter((r) => r.favorite) ?? null : recipes;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-display text-5xl font-extrabold">{t.library.title}</h1>
          {recipes && !isEmpty && <p className="text-muted">{t.library.count(recipes.length)}</p>}
        </div>
        <Link to="/add" className="btn btn-primary"><Plus size={18} weight="bold" /> {t.nav.add}</Link>
      </div>

      {!isEmpty && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xl">
          <label htmlFor="search" className="sr-only">{t.library.search}</label>
          <div className="relative">
            <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="search" type="search" className="input !rounded-full !pl-12" placeholder={t.library.searchHint}
              value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button className="btn btn-ghost btn-icon absolute top-1/2 right-1 -translate-y-1/2 !min-h-10 !w-10"
                aria-label={t.library.clear} onClick={() => setQuery("")}><X size={16} /></button>
            )}
          </div>
        </div>
          <div role="group" aria-label={t.library.show} className="flex gap-2">
            <button type="button" aria-pressed={!onlyFavs} onClick={() => setShow(false)} className={`btn ${!onlyFavs ? "btn-primary" : ""}`}>
              {t.library.all} <span className="tabular-nums opacity-80">{recipes?.length ?? 0}</span>
            </button>
            <button type="button" aria-pressed={onlyFavs} onClick={() => setShow(true)} className={`btn ${onlyFavs ? "btn-primary" : ""}`}>
              <Heart size={18} weight={onlyFavs ? "fill" : "bold"} /> {t.library.favourites} <span className="tabular-nums opacity-80">{favCount}</span>
            </button>
          </div>
        </div>
      )}

      <section aria-live="polite" className="mt-8">
        {error && (
          <div className="grid justify-items-start gap-3 rounded-[var(--r)] border border-danger bg-danger-soft p-6">
            <p className="font-semibold">{t.library.loadError}</p>
            <p>{error}</p>
            <button className="btn" onClick={load}>{t.library.retry}</button>
          </div>
        )}

        {!error && recipes === null && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((n) => <li key={n} className="grid gap-3 p-2"><div className="skeleton aspect-[4/3]" /><div className="skeleton h-6 w-2/3" /><div className="skeleton h-5 w-1/2" /></li>)}
          </ul>
        )}

        {recipes?.length === 0 && q && (
          <div className="grid justify-items-start gap-3 py-8">
            <p className="text-lg">{t.library.none}</p>
            <button className="btn" onClick={() => setQuery("")}>{t.library.clear}</button>
          </div>
        )}

        {isEmpty && (
          <div className="gingham-sage grid items-center gap-6 rounded-[var(--r)] p-8 md:grid-cols-[auto_1fr] md:p-12">
            <CardIllustration className="size-36 text-ink" />
            <div className="grid justify-items-start gap-3">
              <h2 className="font-display text-3xl font-extrabold">{t.library.emptyTitle}</h2>
              <p className="max-w-lg text-lg text-muted">{t.library.emptyBody}</p>
              <Link to="/add" className="btn btn-primary btn-lg"><Plus size={20} weight="bold" /> {t.nav.add}</Link>
            </div>
          </div>
        )}

        {onlyFavs && recipes && recipes.length > 0 && favCount === 0 && (
          <div className="gingham-sage grid justify-items-start gap-3 rounded-[var(--r)] p-8">
            <Heart size={40} weight="duotone" className="text-primary" aria-hidden />
            <h2 className="font-display text-2xl font-extrabold">{t.library.noFavTitle}</h2>
            <p className="max-w-lg text-muted">{t.library.noFavBody}</p>
            <button className="btn" onClick={() => setShow(false)}>{t.library.showAll}</button>
          </div>
        )}

        {shown && shown.length > 0 && (
          <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => <RecipeTile key={r.id} r={r} onToggleFavorite={toggleFavorite} onDelete={setToDelete} />)}
          </ul>
        )}
      </section>

      {isEmpty && (
        <section aria-labelledby="classics-h" className="mt-16">
          <h2 id="classics-h" className="font-display text-3xl font-extrabold">{t.library.classics}</h2>
          <div className="mt-6 grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CLASSICS.map((c) => <ClassicCard key={c.key} c={c} onAdded={load} />)}
          </div>
        </section>
      )}

      <ConfirmDialog open={toDelete !== null} danger
        title={toDelete ? t.library.deleteTitle(toDelete.title) : ""} body={t.recipe.confirmDelBody}
        confirmLabel={t.recipe.del} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />

      <section aria-label="Backup" className="mt-16 flex flex-wrap items-center gap-3 rounded-[var(--r)] border border-line bg-surface p-5">
        <p className="mr-auto max-w-xl text-sm text-muted">{t.library.backupHint}</p>
        <button className="btn" onClick={backup}><DownloadSimple size={18} /> {t.library.backup}</button>
        <button className="btn" onClick={() => fileInput.current?.click()}><UploadSimple size={18} /> {t.library.restore}</button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); }} />
      </section>
    </div>
  );
}
