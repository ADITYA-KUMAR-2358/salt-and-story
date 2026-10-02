import { ArrowCounterClockwise, FileAudio, Info, Microphone, PencilSimpleLine, Sparkle, Stop, UploadSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useCapabilities } from "../components/Capabilities";
import LevelMeter from "../components/LevelMeter";
import Stepper from "../components/Stepper";
import { useToast } from "../components/Toast";
import { CLASSICS } from "../classics";
import { useRecipePoll, useTitle } from "../hooks";
import { t } from "../strings";

type Method = "record" | "upload" | "paste";
const AUDIO_EXT = [".mp3", ".m4a", ".wav", ".webm", ".ogg"];
const MAX_RECORD_MIN = 20;
const MIN_PASTE = 20;
const ICONS = { record: Microphone, upload: FileAudio, paste: PencilSimpleLine };

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function AddMemo() {
  useTitle(t.add.title);
  const nav = useNavigate();
  const toast = useToast();
  const { caps } = useCapabilities();
  const canTranscribe = caps ? caps.transcription : true;
  const maxMb = caps?.max_upload_mb ?? 25;

  const [method, setMethod] = useState<Method>("record");
  const [speaker, setSpeaker] = useState("");
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  const { recipe } = useRecipePoll(id, bump);
  const [elapsed, setElapsed] = useState(0);

  // recording
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recording = !!stream;
  const canRecord = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => { if (!canTranscribe && method !== "paste") setMethod("paste"); }, [canTranscribe, method]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((s) => {
      if (s + 1 >= MAX_RECORD_MIN * 60) recorder.current?.stop();
      return s + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => { if (recipe?.status === "ready") nav(`/recipes/${recipe.id}`, { replace: true }); }, [recipe, nav]);
  // A visible clock while the model works, so a long wait never looks frozen.
  const finished = recipe?.status === "ready" || recipe?.status === "failed";
  useEffect(() => {
    if (id === null || finished) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(timer);
  }, [id, bump, finished]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  // Release the microphone if the page is left mid-recording.
  useEffect(() => () => { recorder.current?.state === "recording" && recorder.current.stop(); }, []);

  async function startRecording() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        s.getTracks().forEach((tr) => tr.stop());
        setStream(null);
        const mime = rec.mimeType || "audio/webm";
        const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunks.current, { type: mime });
        setFile({ blob, name: `recording.${ext}` });
        setPreviewUrl(URL.createObjectURL(blob));
      };
      rec.start(1000);
      recorder.current = rec;
      setSeconds(0);
      setPreviewUrl(null);
      setFile(null);
      setStream(s);
    } catch {
      setError(t.add.recordDenied);
    }
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFileError(null);
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!AUDIO_EXT.includes(ext)) return setFileError(t.add.badType);
    if (f.size > maxMb * 1024 * 1024) return setFileError(t.add.tooBig(maxMb));
    setFile({ blob: f, name: f.name });
  }

  function trySample() {
    const c = CLASSICS[Math.floor(Math.random() * CLASSICS.length)];
    setText(c.transcript);
    if (!speaker) setSpeaker(c.speaker_name ?? "");
  }

  const maxChars = 20000;
  const pasteOk = text.trim().length >= MIN_PASTE && text.length <= maxChars;
  const canSend = !busy && !recording && (method === "paste" ? pasteOk : !!file);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const memo = method === "paste"
        ? await api.fromTranscript(text.trim(), speaker.trim() || null)
        : await api.upload(file!.blob, file!.name, speaker.trim());
      setId(memo.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (id == null) return;
    try { await api.restructure(id); setBump((n) => n + 1); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function byHand() {
    try {
      const r = await api.create({ title: "New recipe", story: "", servings: null, prep_time: null, cook_time: null,
        ingredients: [], steps: [], tips: [], quote: "", speaker_name: speaker.trim() || null });
      nav(`/recipes/${r.id}?edit=1`);
    } catch (err) { setError((err as Error).message); }
  }

  // ---- progress view ----
  if (id !== null) {
    const failed = recipe?.status === "failed";
    return (
      <div className="mx-auto grid max-w-xl gap-6 px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold">{t.add.progressTitle}</h1>
        {!failed && <p className="text-muted">{t.add.progressHint}</p>}
        {!failed && <p className="font-display text-lg font-bold tabular-nums text-primary" aria-live="off">{t.add.elapsed(elapsed)}</p>}
        <div aria-live="polite"><Stepper status={recipe?.status ?? "uploaded"} hasAudio={method !== "paste"} /></div>
        {failed && (
          <div className="grid justify-items-start gap-3 rounded-[var(--r)] border border-danger bg-danger-soft p-5">
            <p className="font-display text-xl font-bold">{t.add.failedTitle}</p>
            <p>{recipe.error}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={retry}><ArrowCounterClockwise size={18} /> {t.add.retry}</button>
              <Link to={`/recipes/${id}?edit=1`} className="btn">{t.add.openAnyway}</Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- form view ----
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">{t.add.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">{t.add.lead}</p>

      {caps && !caps.transcription && (
        <p className="mt-6 flex gap-3 rounded-[var(--r)] bg-accent-soft p-4"><Info size={22} className="mt-0.5 shrink-0" aria-hidden /> {t.add.noTranscription}</p>
      )}
      {caps && !caps.llm.reachable && (
        <p className="mt-4 flex gap-3 rounded-[var(--r)] bg-bg-2 p-4"><Info size={22} className="mt-0.5 shrink-0" aria-hidden /> {t.add.noModel}</p>
      )}

      <form onSubmit={submit} className="mt-8 grid gap-8" noValidate>
        <div className="field">
          <label htmlFor="speaker" className="label">{t.add.speaker}</label>
          <input id="speaker" className="input max-w-md" value={speaker} autoComplete="off" maxLength={80}
            placeholder={t.add.speakerPlaceholder} onChange={(e) => setSpeaker(e.target.value)} aria-describedby="speaker-hint" />
          <p id="speaker-hint" className="hint">{t.add.speakerHint}</p>
        </div>

        <fieldset className="grid gap-3">
          <legend className="label mb-3">{t.add.how}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["record", "upload", "paste"] as const).map((m) => {
              const Icon = ICONS[m];
              const disabled = m !== "paste" && (!canTranscribe || (m === "record" && !canRecord));
              return (
                <label key={m} className={`relative grid cursor-pointer gap-1 rounded-[var(--r)] border-2 p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                  method === m ? "border-primary bg-surface lift" : "border-line hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--line))]"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
                  <input type="radio" name="method" value={m} checked={method === m} disabled={disabled}
                    onChange={() => { setMethod(m); setError(null); }} className="sr-only" />
                  <span className={`mb-1 grid size-11 place-items-center rounded-full ${method === m ? "bg-primary text-on-primary" : "bg-bg-2"}`}>
                    <Icon size={22} weight={method === m ? "fill" : "regular"} />
                  </span>
                  <span className="font-semibold">{t.add.methods[m].label}</span>
                  <span className="text-sm text-muted">{t.add.methods[m].body}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-[var(--r)] border border-line bg-surface p-5 sm:p-7">
          {method === "record" && (
            !canRecord ? <p>{t.add.recordUnsupported}</p> : (
              <div className="grid justify-items-center gap-5 text-center">
                <button type="button" onClick={recording ? () => recorder.current?.stop() : startRecording}
                  aria-label={recording ? t.add.stop : t.add.record}
                  className={`grid size-28 place-items-center rounded-full transition-transform active:scale-95 ${
                    recording ? "bg-danger text-white" : "bg-primary text-on-primary lift hover:scale-105"}`}>
                  {recording ? <Stop size={40} weight="fill" /> : <Microphone size={44} weight="fill" />}
                </button>
                {recording ? (
                  <>
                    <LevelMeter stream={stream} />
                    <p role="timer" className="font-display text-3xl font-bold tabular-nums">{fmt(seconds)}</p>
                    <p className="text-sm text-muted">{t.add.recordLimit(MAX_RECORD_MIN)}</p>
                  </>
                ) : previewUrl ? (
                  <div className="grid w-full max-w-md gap-3">
                    <p className="text-muted">{t.add.recordedReady}</p>
                    <audio controls src={previewUrl} className="w-full" />
                    <button type="button" className="btn mx-auto" onClick={startRecording}><ArrowCounterClockwise size={18} /> {t.add.again}</button>
                  </div>
                ) : (
                  <p className="font-semibold">{t.add.record}</p>
                )}
              </div>
            )
          )}

          {method === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
              className={`grid justify-items-center gap-3 rounded-[var(--r)] border-2 border-dashed p-8 text-center transition-colors ${
                dragging ? "border-primary bg-bg-2" : "border-line"}`}>
              <UploadSimple size={36} className="text-primary" aria-hidden />
              <p className="font-semibold">{file ? file.name : t.add.drop}</p>
              {!file && <p className="text-sm text-muted">{t.add.or}</p>}
              <label className="btn">
                {file ? t.add.replaceFile : t.add.chooseFile}
                <input type="file" accept={AUDIO_EXT.join(",") + ",audio/*"} className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              <p className="text-sm text-muted">{t.add.methods.upload.body} Up to {maxMb} MB.</p>
              {fileError && <p role="alert" className="font-semibold text-danger">{fileError}</p>}
            </div>
          )}

          {method === "paste" && (
            <div className="field">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="paste" className="label">{t.add.pasteLabel}</label>
                <button type="button" className="btn btn-ghost !min-h-9 text-primary" onClick={trySample}>
                  <Sparkle size={18} weight="fill" /> {t.add.sample}
                </button>
              </div>
              <textarea id="paste" className="input min-h-56" value={text} maxLength={maxChars}
                onChange={(e) => setText(e.target.value)} aria-describedby="paste-hint paste-count"
                aria-invalid={text.length > 0 && !pasteOk} />
              <div className="flex flex-wrap justify-between gap-2">
                <p id="paste-hint" className="hint">{text.length > 0 && text.trim().length < MIN_PASTE ? t.add.pasteShort : t.add.pasteHint}</p>
                <p id="paste-count" className="hint tabular-nums">{t.add.chars(text.length, maxChars)}</p>
              </div>
            </div>
          )}
        </div>

        {error && <p role="alert" className="rounded-[var(--r)] border border-danger bg-danger-soft p-4 font-semibold">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSend}>{busy ? t.add.sending : t.add.submit}</button>
          <button type="button" className="btn btn-ghost" onClick={byHand}>{t.add.byHand}</button>
        </div>
      </form>
    </div>
  );
}
