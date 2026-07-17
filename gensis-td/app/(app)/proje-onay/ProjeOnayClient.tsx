"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Company = { id: string; short_name: string; legal_name: string | null };
type Province = { id: number; name: string };
type Cap = { beyan_yuku_kg: number; kisi_sayisi: number | null };
type District = { id: string; name: string };

const RANGE_100 = Array.from({ length: 100 }, (_, i) => i + 1);

export default function ProjeOnayClient({
  companies, provinces, capacity,
}: { companies: Company[]; provinces: Province[]; capacity: Cap[] }) {
  const supabase = createClient();
  const [companyId, setCompanyId] = useState("");
  const [provinceId, setProvinceId] = useState<number | "">("");
  const [districtId, setDistrictId] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [adet, setAdet] = useState("1");
  const [yapiSahibi, setYapiSahibi] = useState("");
  const [montajAdresi, setMontajAdresi] = useState("");
  const [pafta, setPafta] = useState("");
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [beyanYuku, setBeyanYuku] = useState<number | "">("");
  const [beyanHizi, setBeyanHizi] = useState("");
  const [durak, setDurak] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErr, setShowErr] = useState(false);

  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const kisi = useMemo(
    () => (beyanYuku === "" ? null : capacity.find((c) => c.beyan_yuku_kg === beyanYuku)?.kisi_sayisi ?? null),
    [beyanYuku, capacity]
  );
  const company = companies.find((c) => c.id === companyId);
  const provinceName = provinces.find((p) => p.id === provinceId)?.name;
  const districtName = districts.find((d) => d.id === districtId)?.name;

  async function onProvince(idStr: string) {
    const id = idStr ? Number(idStr) : "";
    setProvinceId(id); setDistrictId(""); setDistricts([]);
    if (id !== "") {
      const { data } = await supabase.from("districts").select("id, name").eq("province_id", id).order("name").limit(2000);
      setDistricts(data ?? []);
    }
  }

  const missing =
    !companyId || provinceId === "" || !districtId || !yapiSahibi.trim() || !montajAdresi.trim() ||
    beyanYuku === "" || !beyanHizi.trim() || !durak;
  const ec = (bad: boolean) => (showErr && bad ? " !border-red-300 !bg-red-50" : "");

  async function generate() {
    if (missing) { setShowErr(true); setErr("Kırmızı ile işaretli zorunlu alanları doldurun."); return; }
    setBusy(true); setErr(null); setShowErr(false);
    const payload = {
      firma_adi: company?.short_name || company?.legal_name || "",
      firma_unvan: company?.legal_name || "",
      il: provinceName, belediye: districtName,
      tarih: tarih ? new Date(tarih).toLocaleDateString("tr-TR") : "",
      adet, yapi_sahibi: yapiSahibi, montaj_adresi: montajAdresi,
      pafta, ada, parsel,
      beyan_yuku_kg: beyanYuku, kisi_sayisi: kisi, beyan_hizi: beyanHizi, durak_sayisi: durak,
    };
    try {
      const res = await fetch("/api/pdf/avan-proje-dilekce", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { setErr("PDF üretilemedi: " + (await res.text())); setBusy(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setBusy(false);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 max-w-5xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold mb-1">Avan Proje Onay Dilekçesi</h2>
        <p className="text-xs text-slate-400 mb-5">Firma ve il/belediye listeden seçilir; diğer alanlar elle girilir.</p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Montaj / Mimarlık Firması *" full>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inp + ec(!companyId)}>
              <option value="">Firma seçiniz…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </Field>

          <Field label="İl *">
            <select value={provinceId} onChange={(e) => onProvince(e.target.value)} className={inp + ec(provinceId === "")}>
              <option value="">Seçiniz…</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Belediye (İlçe) *">
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={districts.length === 0} className={inp + ec(!districtId)}>
              <option value="">{provinceId === "" ? "Önce il seçin" : "Seçiniz…"}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>

          <Field label="Dilekçe Tarihi">
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className={inp} />
          </Field>
          <Field label="Asansör Adedi">
            <input type="number" min={1} value={adet} onChange={(e) => setAdet(e.target.value)} className={inp} />
          </Field>

          <Field label="Yapı Sahibi *" full>
            <input value={yapiSahibi} onChange={(e) => setYapiSahibi(e.target.value)} className={inp + ec(!yapiSahibi.trim())} />
          </Field>
          <Field label="Montaj Adresi *" full>
            <input value={montajAdresi} onChange={(e) => setMontajAdresi(e.target.value)} placeholder="Örn. YUNUSELİ MAH. OSMANGAZİ/BURSA" className={inp + ec(!montajAdresi.trim())} />
          </Field>

          <Field label="Pafta"><input value={pafta} onChange={(e) => setPafta(e.target.value)} className={inp} /></Field>
          <Field label="Ada"><input value={ada} onChange={(e) => setAda(e.target.value)} className={inp} /></Field>
          <Field label="Parsel"><input value={parsel} onChange={(e) => setParsel(e.target.value)} className={inp} /></Field>

          <Field label="Beyan Yükü (kg) *">
            <select value={beyanYuku} onChange={(e) => setBeyanYuku(e.target.value ? Number(e.target.value) : "")} className={inp + ec(beyanYuku === "")}>
              <option value="">Seçiniz…</option>
              {capacity.map((c) => <option key={c.beyan_yuku_kg} value={c.beyan_yuku_kg}>{c.beyan_yuku_kg}</option>)}
            </select>
          </Field>
          <Field label="Kişi Sayısı (otomatik)">
            <input value={kisi ?? ""} disabled className={inp + " bg-slate-100"} />
          </Field>
          <Field label="Beyan Hızı (m/s) *">
            <input value={beyanHizi} onChange={(e) => setBeyanHizi(e.target.value)} placeholder="Örn. 1,60" className={inp + ec(!beyanHizi.trim())} />
          </Field>
          <Field label="Durak Sayısı *">
            <select value={durak} onChange={(e) => setDurak(e.target.value)} className={inp + ec(!durak)}>
              <option value="">Seçiniz…</option>
              {RANGE_100.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>

        {err && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>}

        <div className="mt-5">
          <button onClick={generate} disabled={busy}
            className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 disabled:opacity-50">
            <span className="material-symbols-rounded text-[18px]">picture_as_pdf</span>
            {busy ? "Oluşturuluyor…" : "Dilekçeyi Oluştur (PDF)"}
          </button>
        </div>
      </div>

      {/* Özet önizleme */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 h-fit">
        <div className="text-xs font-bold text-slate-500 uppercase mb-3">Önizleme</div>
        <Summ k="Firma" v={company?.short_name} />
        <Summ k="Belediye" v={districtName} />
        <Summ k="İl" v={provinceName} />
        <Summ k="Yapı Sahibi" v={yapiSahibi} />
        <Summ k="Kapasite" v={beyanYuku ? `${beyanYuku} kg · ${kisi ?? "—"} kişi` : ""} />
        <Summ k="Beyan Hızı" v={beyanHizi ? `${beyanHizi} m/s` : ""} />
        <Summ k="Durak" v={durak} />
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
function Summ({ k, v }: { k: string; v?: any }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-slate-800 text-right">{v || "—"}</span>
    </div>
  );
}
