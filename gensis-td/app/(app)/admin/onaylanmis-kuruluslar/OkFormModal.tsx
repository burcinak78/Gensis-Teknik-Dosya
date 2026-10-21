"use client";

import { useState } from "react";
import { COUNTRIES, TR_PROVINCES } from "@/lib/countries";
import { createNotifiedBody, updateNotifiedBody } from "../api";

export type OkNB = {
  id: string;
  short_name: string | null;
  name: string;
  identity_no: string | null;
  city: string | null;
  country: string | null;
};

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

export default function OkFormModal({
  edit, onClose, onSaved, z = 60,
}: {
  edit?: OkNB | null;
  onClose: () => void;
  onSaved: (nb: OkNB) => void;
  z?: number;
}) {
  const isEdit = !!edit;
  const [f, setF] = useState({
    short_name: edit?.short_name ?? "",
    name: edit?.name ?? "",
    identity_no: edit?.identity_no ?? "",
    country: edit?.country ?? "Türkiye",
    city: edit?.city ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const req = (v: string) => (touched && !v.trim() ? " !border-red-300 !bg-red-50" : "");

  async function submit() {
    setTouched(true); setErr(null);
    if (!f.short_name.trim()) return setErr("Kısa ad zorunlu.");
    if (!f.name.trim()) return setErr("Ticari ünvan zorunlu.");
    setBusy(true);
    const payload = {
      short_name: f.short_name.trim(), name: f.name.trim(),
      identity_no: f.identity_no.trim(), city: f.city.trim(), country: f.country.trim(),
    };
    const res = isEdit ? await updateNotifiedBody(edit!.id, payload) : await createNotifiedBody(payload);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onSaved({
      id: isEdit ? edit!.id : ((res as any).id as string),
      short_name: payload.short_name, name: payload.name,
      identity_no: payload.identity_no || null, city: payload.city || null, country: payload.country || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto p-4" style={{ zIndex: z }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-lg">{isEdit ? "Onaylanmış Kuruluş Düzenle" : "Yeni Onaylanmış Kuruluş"}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kısa Ad *</label>
              <input className={inp + req(f.short_name)} value={f.short_name} onChange={(e) => set("short_name", e.target.value)} placeholder="Örn. TÜV" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kuruluş No</label>
              <input className={inp} value={f.identity_no} onChange={(e) => set("identity_no", e.target.value)} placeholder="Örn. 2528" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ticari Ünvan *</label>
            <input className={inp + req(f.name)} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Kuruluşun tam ticari ünvanı" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ülke</label>
              <select className={inp} value={f.country} onChange={(e) => set("country", e.target.value)}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Şehir</label>
              {f.country === "Türkiye" ? (
                <select className={inp} value={f.city} onChange={(e) => set("city", e.target.value)}>
                  <option value="">Seçiniz…</option>
                  {TR_PROVINCES.map((il) => <option key={il} value={il}>{il}</option>)}
                </select>
              ) : (
                <input className={inp} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Şehir" />
              )}
            </div>
          </div>
          {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
            <button type="button" disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
