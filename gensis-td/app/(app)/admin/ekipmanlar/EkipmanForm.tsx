"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createEquipmentModel } from "../actions";

type Cat = { id: string; name: string };
type Brand = { id: string; category_id: string; name: string };
type Cert = { id: string; cert_no: string };

export default function EkipmanForm({ categories, brands, certificates }: { categories: Cat[]; brands: Brand[]; certificates: Cert[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [certId, setCertId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const catBrands = useMemo(() => brands.filter((b) => b.category_id === categoryId), [brands, categoryId]);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await createEquipmentModel({ category_id: categoryId, brand_id: brandId, new_brand: newBrand, model_name: modelName, certificate_id: certId });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: res.message ?? "Eklendi." });
      setModelName(""); setNewBrand("");
      router.refresh();
    } else setMsg({ ok: false, text: res.error });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold mb-4">Yeni Ekipman-Model</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori *</label>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setBrandId(""); }} className={inp}>
            <option value="">Seçiniz…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Marka (mevcut)</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp} disabled={!categoryId}>
            <option value="">{categoryId ? "Seçiniz veya yeni ekleyin…" : "Önce kategori seçin"}</option>
            {catBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">…veya Yeni Marka</label>
          <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className={inp} placeholder="Marka listede yoksa buraya yazın" disabled={!!brandId} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Model Adı *</label>
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Sertifika (opsiyonel)</label>
          <select value={certId} onChange={(e) => setCertId(e.target.value)} className={inp}>
            <option value="">Bağlama yok / sonra</option>
            {certificates.map((c) => <option key={c.id} value={c.id}>{c.cert_no}</option>)}
          </select>
        </div>
      </div>
      {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {busy ? "Ekleniyor…" : "Model Ekle"}
      </button>
    </form>
  );
}
