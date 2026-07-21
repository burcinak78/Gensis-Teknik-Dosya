"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePendingChange, rejectPendingChange } from "../admin/actions";

type Item = {
  id: string;
  kind: string;
  docType: string | null;
  payload: Record<string, any>;
  companyName: string;
  engineerName: string | null;
  submitter: string;
  submittedAt: string;
  originalName: string | null;
  fileUrl: string | null;
  isUpdate: boolean;
};

const KIND_LABEL: Record<string, string> = {
  company_doc: "Firma Belgesi",
  engineer_doc: "Mühendis Belgesi",
  engineer_new: "Yeni Mühendis",
  engineer_edit: "Mühendis Güncelleme",
  company_edit: "Firma Güncelleme",
};
const KIND_ICON: Record<string, string> = {
  company_doc: "description",
  engineer_doc: "description",
  engineer_new: "person_add",
  engineer_edit: "manage_accounts",
  company_edit: "apartment",
};
const COMPANY_DOC: Record<string, string> = {
  sanayi_sicil: "Sanayi Sicil Belgesi", tse_hyb: "TSE HYB Belgesi",
  ce_h1: "Mod H1 Belgesi", ce_tasarim: "Tasarım İnceleme Belgesi",
  ce_b: "Mod B Belgesi", ce_b_eki: "Mod B Eki", ce_e: "Mod E Belgesi",
};
const ENG_DOC: Record<string, string> = {
  asansor_avan_yetki: "Asansör Avan Yetki", asansor_muh_yetki: "Asansör Mühendis Yetki",
  buro_tescil: "Büro Tescil", asansor_tescil: "Asansör Tescil Belgesi",
};
const BRANS: Record<string, string> = { makine: "Makine Müh.", elektrik: "Elektrik Müh." };
const COMPANY_FIELD: Record<string, string> = {
  short_name: "Kısa Ad", legal_name: "Ünvan", authorized_person: "Yetkili",
  registered_brand: "Tescilli Marka", city: "Şehir", phone: "Telefon",
  mobile_phone: "Cep Telefonu", industry_reg_no: "Sanayi Sicil No", address: "Adres", ce_module: "CE Modülü",
};

const tr = (s?: string | null) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");
const trDt = (s?: string | null) => (s ? new Date(s).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—");
const docLabel = (kind: string, t: string | null) =>
  !t ? "" : kind === "company_doc" ? (COMPANY_DOC[t] ?? t) : kind === "engineer_doc" ? (ENG_DOC[t] ?? t) : t;

// Bir kayıt için inceleme satırları (etiket + değer)
function detaylar(it: Item): { l: string; v: string }[] {
  const p = it.payload || {};
  if (it.kind === "company_doc")
    return [
      { l: "Firma", v: it.companyName },
      { l: "Belge", v: docLabel(it.kind, it.docType) },
      { l: "Belge No", v: p.belge_no || "—" },
      { l: "Veriliş Tarihi", v: tr(p.issue_date) },
      { l: "Geçerlilik", v: tr(p.valid_until) },
    ];
  if (it.kind === "engineer_doc")
    return [
      { l: "Firma", v: it.companyName },
      { l: "Mühendis", v: it.engineerName || "—" },
      { l: "Belge", v: docLabel(it.kind, it.docType) },
      { l: "Geçerlilik", v: tr(p.valid_until) },
    ];
  if (it.kind === "engineer_new" || it.kind === "engineer_edit")
    return [
      { l: "Firma", v: it.companyName },
      { l: "Ad Soyad", v: p.full_name || "—" },
      { l: "Branş", v: BRANS[p.discipline] || p.discipline || "—" },
      { l: "Oda Sicil No", v: p.chamber_reg_no || "—" },
      { l: "Adres", v: p.address || "—" },
      { l: "Telefon", v: p.phone || "—" },
    ];
  if (it.kind === "company_edit")
    return [
      { l: "Firma", v: it.companyName },
      ...Object.keys(COMPANY_FIELD)
        .filter((k) => p[k] != null && String(p[k]).trim() !== "")
        .map((k) => ({ l: COMPANY_FIELD[k], v: String(p[k]) })),
    ];
  return [{ l: "Firma", v: it.companyName }];
}

export default function OnaylarClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onOnayla(it: Item) {
    setBusy(true); setMsg(null);
    const r = await approvePendingChange(it.id);
    setBusy(false);
    if (r.ok) { setOpen(null); setReason(""); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  }
  async function onReddet(it: Item) {
    setBusy(true); setMsg(null);
    const r = await rejectPendingChange(it.id, reason.trim() || undefined);
    setBusy(false);
    if (r.ok) { setOpen(null); setReason(""); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  }

  return (
    <div>
      <div className="px-8 pt-6 pb-4 border-b border-[#e7ebf2] sticky top-0 z-30 bg-white">
        <h1 className="text-[24px] font-extrabold tracking-tight">Onay Bekleyenler</h1>
        <p className="text-sm text-slate-500">
          Müşterilerin gönderdiği belge ve kayıt değişiklikleri.{" "}
          {items.length > 0 ? <b className="text-amber-600">{items.length} kayıt onay bekliyor.</b> : "Bekleyen kayıt yok."}
        </p>
      </div>

      <div className="px-8 py-6 gs-fade max-w-4xl">
        {items.length === 0 ? (
          <div className="gs-card rounded-[18px] px-6 py-10 text-center text-slate-400 text-sm">
            Şu an onay bekleyen bir gönderi yok.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="gs-card rounded-[16px] px-5 py-4 flex items-center gap-4">
                <span className="w-10 h-10 rounded-xl grid place-items-center bg-amber-50 text-amber-600 flex-none">
                  <span className="material-symbols-rounded text-[20px]">{KIND_ICON[it.kind] ?? "inventory"}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{KIND_LABEL[it.kind] ?? it.kind}</span>
                    {it.isUpdate && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">GÜNCELLEME</span>}
                    {it.docType && <span className="text-xs text-slate-500">· {docLabel(it.kind, it.docType)}</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {it.companyName}
                    {it.engineerName ? ` · ${it.engineerName}` : ""} · {it.submitter} · {trDt(it.submittedAt)}
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(it); setReason(""); setMsg(null); }}
                  className="flex-none text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg inline-flex items-center gap-1 hover:opacity-90"
                >
                  <span className="material-symbols-rounded text-[16px]">rate_review</span> İncele ve Onayla
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !busy && setOpen(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e7ebf2]">
              <h2 className="font-bold text-slate-800">{KIND_LABEL[open.kind] ?? open.kind}</h2>
              <button onClick={() => !busy && setOpen(null)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-rounded text-[20px]">close</span>
              </button>
            </div>

            <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-auto">
              <dl className="divide-y divide-[#eef1f5]">
                {detaylar(open).map((d, i) => (
                  <div key={i} className="flex gap-4 py-2 text-sm">
                    <dt className="w-32 flex-none text-slate-400">{d.l}</dt>
                    <dd className="text-slate-800 font-medium break-words">{d.v}</dd>
                  </div>
                ))}
              </dl>

              {open.fileUrl ? (
                <a href={open.fileUrl} target="_blank" rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline">
                  <span className="material-symbols-rounded text-[18px]">visibility</span>
                  Yüklenen dosyayı görüntüle{open.originalName ? ` (${open.originalName})` : ""}
                </a>
              ) : (open.kind === "company_doc" || open.kind === "engineer_doc") ? (
                <p className="text-xs text-slate-400 mt-2">Bu güncellemede dosya yok (yalnız tarih/bilgi değişikliği).</p>
              ) : null}

              <div className="pt-2">
                <label className="text-xs text-slate-400">Ret gerekçesi (opsiyonel)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Reddedilecekse kısa bir not…"
                  className="mt-1 w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-navy" />
              </div>

              {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#e7ebf2]">
              <button disabled={busy} onClick={() => onReddet(open)}
                className="text-sm font-semibold text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 inline-flex items-center gap-1">
                <span className="material-symbols-rounded text-[16px]">close</span> Reddet
              </button>
              <button disabled={busy} onClick={() => onOnayla(open)}
                className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1">
                <span className="material-symbols-rounded text-[16px]">check</span> Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
