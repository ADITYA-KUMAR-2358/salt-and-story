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

export const IN_PROGRESS: Status[] = ["uploaded", "transcribing", "structuring"];
export const media = (path: string | null) => (path ? `${API}${path}` : null);

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch {
    throw new ApiError("Cannot reach the server. It may be waking up. Try again in a moment.", 0);
  }
  if (!res.ok) {
    let detail: unknown = `Request failed (${res.status})`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* keep default */ }
    if (Array.isArray(detail)) detail = detail.map((d) => d?.msg ?? String(d)).join(". ");
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
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

export const api = {
  health: (signal?: AbortSignal) => fetch(`${API}/health`, { signal, cache: "no-store" }),
  status: () => call<Capabilities>("/api/status"),
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
  pdfUrl: (id: number) => `${API}/api/recipes/${id}/pdf`,
  bookBlob: async (ids: number[], title: string, dedication: string) => {
    const q = new URLSearchParams({ ids: ids.join(","), title, dedication });
    let res: Response;
    try {
      res = await fetch(`${API}/api/book.pdf?${q}`);
    } catch {
      throw new ApiError("Cannot reach the server. Try again in a moment.", 0);
    }
    if (!res.ok) {
      let d = "";
      try { d = (await res.json()).detail; } catch { /* ignore */ }
      throw new ApiError(d || "The book could not be built.", res.status);
    }
    return res.blob();
  },
};
