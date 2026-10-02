import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog>: focus trap, Esc to cancel and inert background come for free. */
export default function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = "Cancel", danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClick={(e) => { if (e.target === ref.current) onCancel(); }}
      aria-labelledby="confirm-title"
      className="lift m-auto w-[min(92vw,30rem)] rounded-[var(--r)] border border-line bg-surface p-0 text-ink backdrop:bg-[rgb(16_32_26/0.45)] backdrop:backdrop-blur-[2px]"
    >
      <div className="grid gap-3 p-6">
        <h2 id="confirm-title" className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-muted">{body}</p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button className="btn" onClick={onCancel} autoFocus>{cancelLabel}</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
