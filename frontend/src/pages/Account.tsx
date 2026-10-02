import { SignOut, Trash, UserCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import { t } from "../strings";

export default function Account() {
  useTitle(t.account.title);
  const { state, signOut, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);
  if (state.status !== "signed-in") return null;
  const { user, config } = state;
  const limit = user.daily_limit;
  const left = limit > 0 ? Math.max(0, limit - user.used_today) : null;

  async function deleteEverything() {
    setConfirm(false);
    setBusy(true);
    try {
      await api.deleteAccount();
      signOut();
      toast.success(t.account.deleted);
      nav("/", { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-8 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">{t.account.title}</h1>

      <section className="flex flex-wrap items-center gap-4 rounded-[var(--r)] border border-line bg-surface p-6">
        {user.picture
          ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-16 rounded-full object-cover" />
          : <UserCircle size={64} className="text-muted" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-bold">{user.name}</p>
          <p className="text-muted">{user.email}</p>
          {config.mode === "dev" && <p className="mt-1 text-sm font-semibold text-muted">{t.account.devNote}</p>}
        </div>
        {config.mode === "google" && (
          <button className="btn" onClick={() => { signOut(); nav("/", { replace: true }); }}>
            <SignOut size={18} /> {t.account.signOut}
          </button>
        )}
      </section>

      <section aria-labelledby="usage-h" className="grid gap-3 rounded-[var(--r)] border border-line bg-surface p-6">
        <h2 id="usage-h" className="font-display text-2xl font-bold">{t.account.today}</h2>
        {left === null ? (
          <p className="text-muted">{t.account.unlimited}</p>
        ) : (
          <>
            <p className="text-lg"><strong className="font-display text-3xl tabular-nums">{left}</strong> {t.account.left(limit)}</p>
            <div className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: limit }, (_, i) => (
                <span key={i} className={`h-3 flex-1 rounded-full ${i < user.used_today ? "bg-line" : "bg-primary"}`} />
              ))}
            </div>
            <p className="text-sm text-muted">{t.account.whatCounts}</p>
          </>
        )}
      </section>

      <section aria-labelledby="danger-h" className="grid gap-3 rounded-[var(--r)] border border-danger/40 p-6">
        <h2 id="danger-h" className="font-display text-2xl font-bold">{t.account.deleteTitle}</h2>
        <p className="text-muted">{t.account.deleteBody}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={busy}>
            <Trash size={18} /> {t.account.deleteButton}
          </button>
          {config.mode === "google" && (
            <button className="btn" onClick={() => { signOut(); nav("/", { replace: true }); }} disabled={busy}>
              <SignOut size={18} /> {t.account.signOut}
            </button>
          )}
        </div>
      </section>

      <ConfirmDialog open={confirm} danger title={t.account.confirmTitle} body={t.account.confirmBody}
        confirmLabel={t.account.deleteButton} onConfirm={deleteEverything} onCancel={() => setConfirm(false)} />
    </div>
  );
}
