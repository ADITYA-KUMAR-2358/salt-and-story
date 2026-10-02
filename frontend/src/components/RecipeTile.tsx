import { Heart, Quotes, Trash } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { IN_PROGRESS, media, type Recipe } from "../api";
import { t } from "../strings";
import Img from "./Img";
import { StatusBadge } from "./Stepper";

interface Props {
  r: Recipe;
  onToggleFavorite?: (r: Recipe) => void;
  onDelete?: (r: Recipe) => void;
}

/**
 * One recipe in the library: photo (or a gingham placeholder), title, cook, their words.
 * The favourite and delete controls sit on the photo but outside the link, so they are
 * real buttons for keyboards and screen readers, not nested inside an anchor.
 */
export default function RecipeTile({ r, onToggleFavorite, onDelete }: Props) {
  const photo = media(r.photo_url);
  return (
    <li className="group relative min-w-0">
      <Link to={`/recipes/${r.id}`} className="grid h-full gap-3 rounded-[var(--r)] p-2 transition-colors hover:bg-surface focus-visible:bg-surface">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--r)]">
          {photo ? (
            <Img src={photo} alt="" frame="size-full rounded-[var(--r)]"
              className="transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
          ) : (
            <div className="gingham grid size-full place-items-center">
              <span className="font-hand mx-4 line-clamp-2 rounded-full bg-surface px-4 py-1 text-center text-2xl text-ink">{r.title}</span>
            </div>
          )}
          <span className="absolute top-3 left-3"><StatusBadge status={r.status} /></span>
        </div>
        <div className="grid gap-1 px-1 pb-1">
          <h3 className="font-display text-xl leading-snug font-bold group-hover:text-primary">{r.title}</h3>
          {r.speaker_name && <p className="text-sm font-semibold text-muted">{r.speaker_name}</p>}
          {r.quote ? (
            <p className="mt-1 flex gap-1.5 text-muted">
              <Quotes size={18} weight="fill" className="mt-1 shrink-0 text-accent" aria-hidden />
              <span className="font-hand line-clamp-2 text-[1.35rem] leading-7">{r.quote}</span>
            </p>
          ) : r.status === "failed" ? (
            <p className="line-clamp-3 text-sm text-danger">{r.error}</p>
          ) : IN_PROGRESS.includes(r.status) ? (
            <p className="text-sm text-muted">{t.library.stillWriting}</p>
          ) : r.story ? (
            <p className="line-clamp-2 text-sm text-muted">{r.story}</p>
          ) : null}
        </div>
      </Link>

      {(onToggleFavorite || onDelete) && (
        <div className="absolute top-4 right-4 flex gap-2">
          {onToggleFavorite && (
            <button type="button" onClick={() => onToggleFavorite(r)} aria-pressed={r.favorite}
              aria-label={r.favorite ? t.fav.remove(r.title) : t.fav.add(r.title)}
              title={r.favorite ? t.fav.removeShort : t.fav.addShort}
              className="lift grid size-11 place-items-center rounded-full bg-surface/95 text-ink transition-transform hover:scale-105 active:scale-95">
              <Heart key={String(r.favorite)} size={22} weight={r.favorite ? "fill" : "bold"}
                className={r.favorite ? "heart-pop text-primary" : ""} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(r)} aria-label={t.library.deleteOne(r.title)} title={t.recipe.del}
              className="lift grid size-11 place-items-center rounded-full bg-surface/95 text-ink transition-colors hover:bg-danger-soft hover:text-danger">
              <Trash size={20} weight="bold" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
