import { Check, WarningCircle } from "@phosphor-icons/react";
import type { Status } from "../api";
import { t } from "../strings";

const ORDER = ["uploaded", "transcribing", "structuring", "ready"] as const;

/** Progress for one memo. Shows only the steps that apply (pasted words skip listening). */
export default function Stepper({ status, hasAudio = true }: { status: Status; hasAudio?: boolean }) {
  const steps = hasAudio ? ORDER : ORDER.filter((s) => s !== "transcribing" && s !== "uploaded");
  const at = status === "failed" ? -1 : ORDER.indexOf(status);

  return (
    <ol className="grid gap-3" aria-label="Progress">
      {steps.map((s) => {
        const idx = ORDER.indexOf(s);
        const done = status === "ready" || idx < at;
        const current = idx === at && status !== "ready";
        return (
          <li key={s} aria-current={current ? "step" : undefined}
            className={`flex items-center gap-3 rounded-full border px-4 py-3 transition-colors ${
              current ? "border-primary bg-surface lift" : done ? "border-transparent bg-bg-2" : "border-line"
            }`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${
              done ? "bg-primary text-on-primary" : current ? "bg-accent text-on-accent" : "bg-bg-2 text-muted"}`}>
              {done ? <Check size={16} weight="bold" />
                : current ? <span className="size-2.5 rounded-full bg-current motion-safe:animate-ping" />
                : <span className="size-2 rounded-full bg-current" />}
            </span>
            <span className={current || done ? "font-semibold" : "text-muted"}>{t.status[s]}</span>
          </li>
        );
      })}
      {status === "failed" && (
        <li className="flex items-center gap-3 rounded-full border border-danger bg-danger-soft px-4 py-3 font-semibold">
          <WarningCircle size={24} weight="fill" className="text-danger" /> {t.status.failed}
        </li>
      )}
    </ol>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  if (status === "ready") return null;
  const failed = status === "failed";
  return (
    <span className={`chip ${failed ? "bg-danger-soft text-danger" : "bg-accent text-on-accent"}`}>
      {!failed && <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden />}
      {failed ? t.status.failed : t.status[status] ?? t.status.working}
    </span>
  );
}
