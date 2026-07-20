"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Musteri = { id: string; companyId: string; firma: string; docType: string; belgeNo: string | null; valid_until: string };
type Muhendis = { id: string; engineerId: string; ad: string; brans: string; docType: string; valid_until: string };
type Ekipman = { modelId: string; model: string; marka: string; kategori: string; certNo: string; valid_until: string };

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
const BADGE: Record<string, string> = { red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-700" };

function durum(valid: string) {
  const d = new Date(valid); const now = new Date(); now.setHours(0, 0, 0, 0);
  if (d < now) return { t: "Geçersiz", c: "red" };
  return { t: "1 aydan az", c: "amber" };
}
const tr = (s: string) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");

// Sütun tanımı: value = filtre/gösterim metni, render = özel hücre (rozet/link)
type Col<T> = {
  key: string;
  label: string;
  filter?: boolean;
  value?: (r: T) => string;
  render?: (r: T) => React.ReactNode;
  cell?: "bold" | "muted";
  align?: "right";
};

export default function BildirimlerClient({
  role, isStaff, musteri, muhendis, ekipman,
}: { role: string; isStaff: boolean; musteri: Musteri[]; muhendis: Muhendis[]; ekipman: Ekipman[] }) {
  const toplam = musteri.length + muhendis.length + (isStaff ? ekipman.length : 0);
  const guncelleMusteri = isStaff
    ? (m: Musteri) => <Guncelle href={`/admin/musteriler?edit=${m.companyId}`} />
    : () => <span className="text-xs text-slate-400">Gensis güncelleyecek</span>;
  const guncelleMuhendis = isStaff
    ? (m: Muhendis) => <Guncelle href={`/admin/muhendisler?edit=${m.engineerId}`} />
    : () => <span className="text-xs text-slate-400">Gensis güncelleyecek</span>;

  const musteriCols: Col<Musteri>[] = [
    { key: "firma", label: "Müşteri İsmi", filter: true, value: (m) => m.firma, cell: "bold" },
    { key: "belge", label: "Belge", filter: true, value: (m) => COMPANY_DOC[m.docType] ?? m.docType },
    { key: "belgeNo", label: "Belge No", value: (m) => m.belgeNo || "—", cell: "muted" },
    { key: "gecerlilik", label: "Geçerlilik", value: (m) => tr(m.valid_until), cell: "muted" },
    { key: "durum", label: "Durum", filter: true, value: (m) => durum(m.valid_until).t, render: (m) => <Badge du={durum(m.valid_until)} /> },
    { key: "actions", label: "", align: "right", render: guncelleMusteri },
  ];
  const muhendisCols: Col<Muhendis>[] = [
    { key: "ad", label: "Mühendis İsmi", filter: true, value: (m) => m.ad, cell: "bold" },
    { key: "brans", label: "Branş", filter: true, value: (m) => BRANS[m.brans] ?? m.brans, cell: "muted" },
    { key: "belge", label: "Belge", filter: true, value: (m) => ENG_DOC[m.docType] ?? m.docType },
    { key: "gecerlilik", label: "Geçerlilik", value: (m) => tr(m.valid_until), cell: "muted" },
    { key: "durum", label: "Durum", filter: true, value: (m) => durum(m.valid_until).t, render: (m) => <Badge du={durum(m.valid_until)} /> },
    { key: "actions", label: "", align: "right", render: guncelleMuhendis },
  ];
  const ekipmanCols: Col<Ekipman>[] = [
    { key: "kategori", label: "Ekipman Tipi", filter: true, value: (m) => m.kategori, cell: "bold" },
    { key: "marka", label: "Marka", filter: true, value: (m) => m.marka, cell: "muted" },
    { key: "model", label: "Model", filter: true, value: (m) => m.model },
    { key: "certNo", label: "Sertifika No", value: (m) => m.certNo || "—", cell: "muted" },
    { key: "gecerlilik", label: "Geçerlilik", value: (m) => tr(m.valid_until), cell: "muted" },
    { key: "durum", label: "Durum", filter: true, value: (m) => durum(m.valid_until).t, render: (m) => <Badge du={durum(m.valid_until)} /> },
    { key: "actions", label: "", align: "right", render: () => null },
  ];
  // Ekipmanda güncelle linki
  ekipmanCols[ekipmanCols.length - 1].render = (m: Ekipman) => <Guncelle href={`/admin/ekipmanlar?edit=${m.modelId}`} />;

  return (
    <div>
      <div className="px-8 pt-6 pb-4 border-b border-[#e7ebf2]">
        <h1 className="text-[24px] font-extrabold tracking-tight">Bildirimler</h1>
        <p className="text-sm text-slate-500">
          Geçerliliğine 1 aydan az kalan veya süresi dolmuş belgeler.{" "}
          {toplam > 0 ? <b className="text-red-600">{toplam} belge dikkat gerektiriyor.</b> : "Şu an dikkat gerektiren belge yok."}
        </p>
      </div>

      <div className="px-8 py-6 space-y-6 gs-fade max-w-5xl">
        <Grup baslik="Müşteri Dokümanları" rows={musteri} cols={musteriCols} keyOf={(m) => m.id} />
        <Grup baslik="Mühendis Dokümanları" rows={muhendis} cols={muhendisCols} keyOf={(m) => m.id} />
        {isStaff && <Grup baslik="Ekipman Sertifikaları" rows={ekipman} cols={ekipmanCols} keyOf={(m) => m.modelId} />}
      </div>
    </div>
  );
}

function Grup<T>({ baslik, rows, cols, keyOf }: { baslik: string; rows: T[]; cols: Col<T>[]; keyOf: (r: T) => string }) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtreliKolonlar = cols.filter((c) => c.filter && c.value);
  const secenekler = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of filtreliKolonlar) {
      m[c.key] = Array.from(new Set(rows.map((r) => c.value!(r)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
    }
    return m;
  }, [rows, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtreli = rows.filter((r) =>
    cols.every((c) => {
      const f = filters[c.key];
      if (!f || !c.value) return true;
      return c.value(r) === f;
    })
  );
  const aktifFiltre = Object.values(filters).some(Boolean);

  return (
    <div className="gs-card rounded-[18px] overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 ${open ? "border-b border-[#e5e9f0]" : ""}`}>
        <span className="font-bold text-sm">{baslik}</span>
        <span className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rows.length ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"}`}>
            {aktifFiltre ? `${filtreli.length} / ${rows.length}` : rows.length}
          </span>
          <span className="material-symbols-rounded text-[18px] text-slate-400">{open ? "expand_less" : "expand_more"}</span>
        </span>
      </button>

      {open && (rows.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-400">Dikkat gerektiren belge yok.</div>
      ) : (
        <>
          {filtreliKolonlar.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[#eef1f5] bg-white">
              {filtreliKolonlar.map((c) => (
                <select key={c.key} value={filters[c.key] ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                  className={`text-xs rounded-lg px-2 py-1.5 bg-white border ${filters[c.key] ? "border-navy text-navy font-semibold" : "border-slate-200 text-slate-600"}`}>
                  <option value="">{c.label}: Tümü</option>
                  {secenekler[c.key]?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              {aktifFiltre && (
                <button type="button" onClick={() => setFilters({})}
                  className="text-xs font-semibold text-slate-500 hover:text-navy inline-flex items-center gap-1 px-2 py-1.5">
                  <span className="material-symbols-rounded text-[15px]">close</span> Temizle
                </button>
              )}
            </div>
          )}

          {filtreli.length === 0 ? (
            <div className="px-5 py-4 text-sm text-slate-400">Seçime uygun kayıt yok.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                  {cols.map((c) => <th key={c.key} className={`px-5 py-2 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtreli.map((r) => (
                  <Row key={keyOf(r)}>
                    {cols.map((c) => (
                      <Td key={c.key} bold={c.cell === "bold"} muted={c.cell === "muted"} right={c.align === "right"}>
                        {c.render ? c.render(r) : c.value ? c.value(r) : null}
                      </Td>
                    ))}
                  </Row>
                ))}
              </tbody>
            </table>
          )}
        </>
      ))}
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <tr className="border-t border-[#e5e9f0]">{children}</tr>;
const Td = ({ children, bold, muted, right }: { children: React.ReactNode; bold?: boolean; muted?: boolean; right?: boolean }) => (
  <td className={`px-5 py-2.5 ${bold ? "font-semibold text-slate-800" : muted ? "text-slate-500" : "text-slate-700"} ${right ? "text-right" : ""}`}>{children}</td>
);
const Badge = ({ du }: { du: { t: string; c: string } }) => <span className={`text-xs font-semibold px-2 py-1 rounded-full ${BADGE[du.c]}`}>{du.t}</span>;
const Guncelle = ({ href }: { href: string }) => (
  <Link href={href} className="text-xs font-semibold text-navy hover:underline inline-flex items-center gap-1">
    <span className="material-symbols-rounded text-[15px]">upload</span> Güncelle
  </Link>
);
