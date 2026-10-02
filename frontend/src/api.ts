export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Status = "uploaded" | "transcribing" | "structuring" | "ready" | "failed";
export interface Ingredient { name: string; quantity: string | null; note: string | null }
export interface RecipeDraft {
  title: string; story: string; servings: string | null; prep_time: string | null;
  cook_time: string | null; ingredients: Ingredient[]; steps: string[]; tips: string[];
  quote: string; speaker_name: string | null;
}
export interface Recipe extends RecipeDraft {
  id: number; created_at: string; updated_at: string | null; status: Status; error: string | null;
  transcript: string; has_audio: boolean; narration_url: string | null; photo_url: string | null;
  favorite: boolean;
}
export interface Capabilities {
  transcription: boolean; narration: boolean;
  llm: { model: string; reachable: boolean };
  max_upload_mb: number; max_photo_mb: number;
}
export type AuthMode = "google" | "dev" | "closed";
export interface AuthConfig { mode: AuthMode; google_client_id: string; daily_limit: number }
export interface User { id: number; name: string; email: string; picture: string; used_today: number; daily_limit: number }

export const IN_PROGRESS: Status[] = ["uploaded", "transcribing", "structuring"];
export const media = (path: string | null) => (path ? `${API}${path}` : null);

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// ---- session token -----------------------------------------------------------
// Kept in localStorage so a refresh keeps you signed in. The strict CSP (no inline or
// third-party scripts except Google's sign-in) is what protects it from injected code.
const TOKEN_KEY = "salt-and-story:session";
export const session = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode: lasts this tab only */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};
/** Fired when the server says the session is missing or expired. */
export const UNAUTHORIZED_EVENT = "salt:unauthorized";

function withAuth(init: RequestInit = {}): RequestInit {
  const token = session.get();
  if (!token) return init;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  let detail: unknown = fallback;
  try { detail = (await res.json()).detail ?? detail; } catch { /* keep default */ }
  if (Array.isArray(detail)) detail = detail.map((d) => d?.msg ?? String(d)).join(". ");
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  return new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), res.status);
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API}${path}`, withAuth(init));
  } catch {
    throw new ApiError("Cannot reach the server. It may be waking up. Try again in a moment.", 0);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  if (!res.ok) throw await readError(res, `Request failed (${res.status})`);
  return res.status === 204 ? (undefined as T) : res.json();
}

async function blob(path: string, fallback: string): Promise<Blob> {
  const res = await send(path);
  if (!res.ok) throw await readError(res, fallback);
  return res.blob();
}

const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

const form = (file: Blob, name: string, extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.append("file", file, name);
  for (const [k, v] of Object.entries(extra)) if (v) f.append(k, v);
  return f;
};

/** Save a Blob as a file without leaving the page. */
export function saveBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  health: (signal?: AbortSignal) => fetch(`${API}/health`, { signal, cache: "no-store" }),
  status: () => call<Capabilities>("/api/status"),

  authConfig: () => call<AuthConfig>("/api/auth/config"),
  signInWithGoogle: (credential: string) =>
    call<{ token: string; user: User }>("/api/auth/google", json("POST", { credential })),
  me: () => call<User>("/api/auth/me"),
  deleteAccount: () => call<void>("/api/auth/me", { method: "DELETE" }),

  list: (q = "") => call<Recipe[]>(`/api/recipes${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  get: (id: number) => call<Recipe>(`/api/recipes/${id}`),
  create: (draft: RecipeDraft) => call<Recipe>("/api/recipes", json("POST", draft)),
  update: (id: number, r: RecipeDraft) => call<Recipe>(`/api/recipes/${id}`, json("PUT", r)),
  remove: (id: number) => call<void>(`/api/recipes/${id}`, { method: "DELETE" }),
  setFavorite: (id: number, favorite: boolean) => call<Recipe>(`/api/recipes/${id}/favorite`, json("PATCH", { favorite })),
  restructure: (id: number) =>
    call<{ id: number; status: Status }>(`/api/recipes/${id}/restructure`, { method: "POST" }),
  narrate: (id: number) => call<{ url: string }>(`/api/recipes/${id}/narrate`, { method: "POST" }),
  uploadPhoto: (id: number, file: Blob, name: string) =>
    call<Recipe>(`/api/recipes/${id}/photo`, { method: "POST", body: form(file, name) }),
  deletePhoto: (id: number) => call<Recipe>(`/api/recipes/${id}/photo`, { method: "DELETE" }),
  fromTranscript: (transcript: string, speaker_name: string | null) =>
    call<{ id: number; status: Status }>("/api/transcript", json("POST", { transcript, speaker_name })),
  upload: (file: Blob, name: string, speaker: string) =>
    call<{ id: number; status: Status }>("/api/memos", { method: "POST", body: form(file, name, { speaker_name: speaker }) }),
  exportAll: () => call<Recipe[]>("/api/export"),
  importAll: (items: unknown[]) => call<{ imported: number }>("/api/import", json("POST", items)),
  recipePdf: (id: number) => blob(`/api/recipes/${id}/pdf`, "The recipe PDF could not be made."),
  /** by: null = the cooks' names automatically; "" = no "told by" line; text = exactly that. */
  bookBlob: (ids: number[], title: string, dedication: string, by: string | null = null) => {
    const q = new URLSearchParams({ ids: ids.join(","), title, dedication });
    if (by !== null) q.set("by", by);
    return blob(`/api/book.pdf?${q}`, "The book could not be built.");
  },
};
