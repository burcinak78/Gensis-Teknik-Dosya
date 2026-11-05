"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { KUTUPHANE_KODLARI, belgeBasligi } from "@/lib/pdf/belgeler";

export type LibraryItem = {
  id: string; companyId: string; companyShortName: string; docType: string; originalName: string; sizeBytes: number;
  isDefault: boolean; archivedAt: string | null; uploadedAt: string; usedBy: number;
};
type CompanyName = { id: string; shortName: string };

const MAX_BYTES = 50 * 1024 * 1024;
const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// Bozuk ve şifreli dosyayı erken söylemek için; asıl denetim sunucuda ve PDF üretiminde.
async function browserCheck(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) return "Dosya 50 MB'den büyük olamaz.";
  const { PDFDocument, EncryptedPDFError } = await import("pdf-lib");
  try {
    await PDFDocument.load(await file.arrayBuffer());
    return null;
  } catch (e) {
    return e instanceof EncryptedPDFError ? "Şifreli PDF yüklenemez." : "Bu dosya PDF olarak açılamadı.";
  }
}

function YeniDokuman({ companies, onDone }: { companies: CompanyName[]; onDone: () => void }) {
  const [companyId, setCompanyId] = useState("");
  const [docType, setDocType] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!companyId || !docType || !file) { setMsg({ ok: false, text: "Müşteri, tip ve PDF seçin." }); return; }
    setBusy(true);
    try {
      const problem = await browserCheck(file);
      if (problem) { setMsg({ ok: false, text: problem }); return; }
      const up = await api<{ key: string; url: string; contentType: string }>("/api/document-library/upload-url", {
        method: "POST", body: JSON.stringify({ companyId, docType, fileName: file.name }),
      });
      const put = await fetch(up.url, { method: "PUT", headers: { "content-type": up.contentType }, body: file });
      if (!put.ok) throw new Error("Dosya yüklenemedi.");
      await api("/api/document-library", {
        method: "POST", body: JSON.stringify({ companyId, key: up.key, originalName: file.name, isDefault }),
      });
      setMsg({ ok: true, text: "Doküman eklendi." });
      setFile(null); setIsDefault(false);
      (e.target as HTMLFormElement).reset();
      onDone();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Doküman eklenemedi.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      <h2 className="font-bold mb-4">Yeni Doküman</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="dok-musteri" className="block text-xs font-semibold text-slate-600 mb-1">Müşteri *</label>
          <select id="dok-musteri" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inp}>
            <option value="">Seçiniz…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dok-tip" className="block text-xs font-semibold text-slate-600 mb-1">Tip *</label>
          <select id="dok-tip" value={docType} onChange={(e) => setDocType(e.target.value)} className={inp}>
            <option value="">Seçiniz…</option>
            {KUTUPHANE_KODLARI.map((c) => <option key={c} value={c}>{belgeBasligi(c)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dok-dosya" className="block text-xs font-semibold text-slate-600 mb-1">PDF *</label>
          <input id="dok-dosya" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
          <p className="text-xs text-slate-400 mt-1">Yalnız PDF, en çok 50 MB, şifresiz. Dosya olduğu gibi girer; proje bilgisi, header, footer eklenmez.</p>
        </div>
        <label className="flex items-center gap-2 text-sm self-center">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Varsayılan Olsun
        </label>
      </div>
      {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {busy ? "Kaydediliyor…" : "Dokümanı Kaydet"}
      </button>
    </form>
  );
}

export default function DokumanlarClient({ documents, companies }: { documents: LibraryItem[]; companies: CompanyName[] }) {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => documents.filter((d) =>
    (!company || d.companyId === company) && (!type || d.docType === type) && (showArchived || !d.archivedAt)),
  [documents, company, type, showArchived]);

  async function setDefault(d: LibraryItem, isDefault: boolean) {
    setError(null);
    try {
      await api(`/api/document-library/${d.id}`, { method: "PUT", body: JSON.stringify({ isDefault }) });
      router.refresh();
    } catch (e) {
      setError(errorText(e, "Kaydedilemedi."));
    }
  }

  async function remove(d: LibraryItem) {
    const text = d.usedBy > 0
      ? `"${d.originalName}" ${d.usedBy} teknik dosyada kullanılıyor; silinmez, arşivlenir. Devam edilsin mi?`
      : `"${d.originalName}" silinsin mi? Bu işlem geri alınamaz.`;
    if (!confirm(text)) return;
    setError(null);
    try {
      await api(`/api/document-library/${d.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(errorText(e, "Silinemedi."));
    }
  }

  const th = "text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wide px-4 py-3";
  const td = "px-4 py-3 text-sm";
  return (
    <div>
      <YeniDokuman companies={companies} onDone={() => router.refresh()} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select aria-label="Müşteri filtresi" value={company} onChange={(e) => setCompany(e.target.value)} className={inp + " max-w-xs"}>
          <option value="">Tüm müşteriler</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
        </select>
        <select aria-label="Tip filtresi" value={type} onChange={(e) => setType(e.target.value)} className={inp + " max-w-xs"}>
          <option value="">Tüm tipler</option>
          {KUTUPHANE_KODLARI.map((c) => <option key={c} value={c}>{belgeBasligi(c)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Arşivlenenleri göster
        </label>
      </div>
      {error && <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{error}</div>}

      <div className="gs-card rounded-[18px] overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-[#e5e9f0]">
            <th className={th}>Müşteri</th><th className={th}>Tip</th><th className={th}>Dosya</th><th className={th}>Durum</th><th className={th}>Kullanım</th><th className={th} />
          </tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-[#eef1f7] last:border-0">
                <td className={td}>{d.companyShortName}</td>
                <td className={td}>{belgeBasligi(d.docType)}</td>
                <td className={td + " max-w-[280px] truncate"}>
                  <a href={`/api/files/library/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-navy font-semibold hover:underline">{d.originalName}</a>
                </td>
                <td className={td}>
                  {d.archivedAt ? <span className="text-slate-400">Arşivde</span>
                    : d.isDefault ? <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">Varsayılan</span>
                    : <span className="text-slate-500">Normal</span>}
                </td>
                <td className={td + " text-slate-500"}>{d.usedBy} TD</td>
                <td className={td + " whitespace-nowrap text-right"}>
                  {!d.archivedAt && (
                    <button onClick={() => setDefault(d, !d.isDefault)} className="text-navy font-semibold hover:underline mr-3">
                      {d.isDefault ? "Varsayılanı kaldır" : "Varsayılan yap"}
                    </button>
                  )}
                  {!(d.archivedAt && d.usedBy > 0) && (
                    <button onClick={() => remove(d)} className="text-red-600 font-semibold hover:underline">{d.usedBy > 0 ? "Arşivle" : "Sil"}</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className={td + " text-slate-500 text-center"}>Kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
