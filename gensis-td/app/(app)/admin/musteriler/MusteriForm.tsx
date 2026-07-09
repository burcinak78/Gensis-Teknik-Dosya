"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "../actions";

const FIELDS: [string, string, boolean][] = [
  ["short_name", "Kısa Ad *", true],
  ["legal_name", "Ticari Ünvan *", true],
  ["authorized_person", "Yetkili / Ünvanı", false],
  ["registered_brand", "Tescilli Marka", false],
  ["city", "Şehir", false],
  ["phone", "Telefon", false],
  ["fax", "Faks", false],
  ["industry_reg_no", "Sanayi Sicil No", false],
  ["address", "Adres", false],
];

export default function MusteriForm() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await createCompany(form);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: res.message ?? "Eklendi." });
      setForm({});
      router.refresh();
    } else setMsg({ ok: false, text: res.error });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold mb-4">Yeni Müşteri</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(([k, label]) => (
          <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
            <input
              value={form[k] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand"
            />
          </div>
        ))}
      </div>
      {msg && (
        <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>
      )}
      <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {busy ? "Ekleniyor…" : "Müşteri Ekle"}
      </button>
    </form>
  );
}
