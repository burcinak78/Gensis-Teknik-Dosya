// Notes against the C# API (each user's own), with the old server actions' names and results.
import { api, ApiError } from "@/lib/api/client";

export type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

const fail = (e: unknown, fallback: string): Result =>
  ({ ok: false, error: e instanceof ApiError ? (e.status === 404 ? "Not bulunamadı." : e.message) : fallback });

export async function createNote(icerik: string): Promise<Result> {
  if (!icerik?.trim()) return { ok: false, error: "Not boş olamaz." };
  try {
    const r = await api<{ id: string; message: string }>("/api/notes", { method: "POST", body: JSON.stringify({ icerik }) });
    return { ok: true, id: r.id, message: r.message };
  } catch (e) {
    return fail(e, "Not eklenemedi.");
  }
}

export async function snoozeNote(id: string): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/notes/${id}/snooze`, { method: "POST" });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Not ertelenemedi.");
  }
}

export async function deleteNote(id: string): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/notes/${id}`, { method: "DELETE" });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Not silinemedi.");
  }
}
