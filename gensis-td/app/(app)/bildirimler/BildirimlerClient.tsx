"use client";

import { useState } from "react";
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

export default function BildirimlerClient({
  role, isStaff, musteri, muhendis, ekipman,
}: { role: string; isStaff: boolean; musteri: Musteri[]; muhendis: Muhendis[]; ekipman: Ekipman[] }) {
  const toplam = musteri.length + muhendis.length + (isStaff ? ekipman.length : 0);

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
        {/* Müşteri Dokümanları */}
        <Grup baslik="Müşteri Dokümanları" adet={musteri.length}
          cols={["Müşteri İsmi", "Belge", "Belge No", "Geçerlilik", "Durum", ""]}>
          {musteri.map((m) => {
            const du = durum(m.valid_until);
            return (
              <Row key={m.id}>
                <Td bold>{m.firma}</Td>
                <Td>{COMPANY_DOC[m.docType] ?? m.docType}</Td>
                <Td muted>{m.belgeNo || "—"}</Td>
                <Td muted>{tr(m.valid_until)}</Td>
                <Td><Badge du={du} /></Td>
                <Td right>{isStaff ? <Guncelle href={`/admin/musteriler?edit=${m.companyId}`} /> : <span className="text-xs text-slate-400">Gensis güncelleyecek</span>}</Td>
              </Row>
            );
          })}
        </Grup>

        {/* Mühendis Dokümanları */}
        <Grup baslik="Mühendis Dokümanları" adet={muhendis.length}
          cols={["Mühendis İsmi", "Branş", "Belge", "Geçerlilik", "Durum", ""]}>
          {muhendis.map((m) => {
            const du = durum(m.valid_until);
            return (
              <Row key={m.id}>
                <Td bold>{m.ad}</Td>
                <Td muted>{BRANS[m.brans] ?? m.brans}</Td>
                <Td>{ENG_DOC[m.docType] ?? m.docType}</Td>
                <Td muted>{tr(m.valid_until)}</Td>
                <Td><Badge du={du} /></Td>
                <Td right>{isStaff ? <Guncelle href={`/admin/muhendisler?edit=${m.engineerId}`} /> : <span className="text-xs text-slate-400">Gensis güncelleyecek</span>}</Td>
              </Row>
            );
          })}
        </Grup>

        {/* Ekipman Sertifikaları — yalnız Admin/Gensis */}
        {isStaff && (
          <Grup baslik="Ekipman Sertifikaları" adet={ekipman.length}
            cols={["Ekipman Tipi", "Marka", "Model", "Sertifika No", "Geçerlilik", "Durum", ""]}>
            {ekipman.map((m) => {
              const du = durum(m.valid_until);
              return (
                <Row key={m.modelId}>
                  <Td bold>{m.kategori}</Td>
                  <Td muted>{m.marka}</Td>
                  <Td>{m.model}</Td>
                  <Td muted>{m.certNo || "—"}</Td>
                  <Td muted>{tr(m.valid_until)}</Td>
                  <Td><Badge du={du} /></Td>
                  <Td right><Guncelle href={`/admin/ekipmanlar?edit=${m.modelId}`} /></Td>
                </Row>
              );
            })}
          </Grup>
        )}
      </div>
    </div>
  );
}

function Grup({ baslik, adet, cols, children }: { baslik: string; adet: number; cols: string[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gs-card rounded-[18px] overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 ${open ? "border-b border-[#e5e9f0]" : ""}`}>
        <span className="font-bold text-sm">{baslik}</span>
        <span className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${adet ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"}`}>{adet}</span>
          <span className="material-symbols-rounded text-[18px] text-slate-400">{open ? "expand_less" : "expand_more"}</span>
        </span>
      </button>
      {open && (
        adet === 0 ? (
          <div className="px-5 py-4 text-sm text-slate-400">Dikkat gerektiren belge yok.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                {cols.map((c, i) => <th key={i} className={`px-5 py-2 ${i === cols.length - 1 ? "text-right" : ""}`}>{c}</th>)}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        )
      )}
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
