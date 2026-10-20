"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function actor() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  return { supabase, userId: user.id };
}

export async function createNote(icerik: string): Promise<Result> {
  try {
    const { supabase, userId } = await actor();
    if (!icerik?.trim()) return { ok: false, error: "Not boş olamaz." };
    const { data, error } = await supabase.from("notlar")
      .insert({ user_id: userId, icerik: icerik.trim() })
      .select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Not eklenemedi." };
    revalidatePath("/notlar");
    return { ok: true, id: data.id, message: "Not eklendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function snoozeNote(id: string): Promise<Result> {
  try {
    const { supabase } = await actor();
    if (!id) return { ok: false, error: "Not bulunamadı." };
    const { error } = await supabase.from("notlar")
      .update({ sayac_baslangic: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/notlar");
    return { ok: true, message: "Not ertelendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function deleteNote(id: string): Promise<Result> {
  try {
    const { supabase } = await actor();
    if (!id) return { ok: false, error: "Not bulunamadı." };
    const { error } = await supabase.from("notlar").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/notlar");
    return { ok: true, message: "Not silindi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
