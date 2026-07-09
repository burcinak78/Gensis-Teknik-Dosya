"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCertificate } from "../actions";

type NB = { id: string; identity_no: string | null; name: string };
type ModelOpt = { id: string; label: string };

export default function SertifikaForm({ notifiedBodies, models }: { notifiedBodies: NB[]; models: ModelOpt[] }) {
  const router = useRouter();
  const [certNo, setCertNo] = useState("");
  const [nbId, setNbId] = useState("");
  const [modelId, setModelId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("cert_no", certNo);
    fd.append("notified_body_id", nbId);
    fd.append("model_id", modelId);
    if (file) fd.append("file", file);
    const res = await createCertificate(fd);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: res.message ?? "Kaydedildi." });
      setCertNo(""); setFile(null); setModelId("");
      router.refresh();
    } else setMsg({ ok: false, text: res.error });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold mb-4">Yeni Sertifika Yükle</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Sertifika No *</label>
          <input value={certNo} onChange={(e) => setCertNo(e.target.value)} className={inp} placeholder="ör. LDsq08-0117-0240-24" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Onaylanmış Kuruluş</label>
          <select value={nbId} onChange={(e) => setNbId(e.target.value)} className={inp}>
            <option value="">Seçiniz…</option>
            {notifiedBodies.map((n) => <option key={n.id} value={n.id}>{n.identity_no ? `${n.identity_no} · ` : ""}{n.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Bağlanacak Ekipman Modeli (opsiyonel)</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={inp}>
            <option value="">Bağlama yok</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Sertifika PDF</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
          <p className="text-xs text-slate-400 mt-1">Yeni PDF yüklerseniz sertifikanın yeni sürümü olarak kaydedilir.</p>
        </div>
      </div>
      {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {busy ? "Kaydediliyor…" : "Sertifikayı Kaydet"}
      </button>
    </form>
  );
}
