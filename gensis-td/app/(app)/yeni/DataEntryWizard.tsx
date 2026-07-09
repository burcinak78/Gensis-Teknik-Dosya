"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveDraftProject, type DraftPayload } from "./actions";

type Company = {
  id: string;
  short_name: string;
  legal_name: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  city: string | null;
  authorized_person: string | null;
  registered_brand: string | null;
  industry_reg_no: string | null;
};
type Category = { id: string; code: string; name: string; sort_order: number };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Certificate = { id: string; cert_no: string; notified_body_id: string | null };
type NotifiedBody = { id: string; identity_no: string | null; name: string };
type Province = { id: number; name: string };
type Capacity = {
  beyan_yuku_kg: number;
  kisi_sayisi: number | null;
  kabin_agirlik_kg: number | null;
  karsi_agirlik_kg: number | null;
};
type Lookup = { list_key: string; value: string; sort_order: number };
type District = { id: string; name: string };

type Props = {
  companies: Company[];
  categories: Category[];
  brands: Brand[];
  models: Model[];
  certificates: Certificate[];
  notifiedBodies: NotifiedBody[];
  provinces: Province[];
  capacity: Capacity[];
  lookups: Lookup[];
};

const STEPS = ["Firma", "Yapı Ruhsatı", "Asansör", "Ekipmanlar", "Önizleme"];

export default function DataEntryWizard(props: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState("");
  const [dosyaNo, setDosyaNo] = useState("");
  const [dosyaTarihi, setDosyaTarihi] = useState(new Date().toISOString().slice(0, 10));
  const [binaAdi, setBinaAdi] = useState("");
  const [montajAdresi, setMontajAdresi] = useState("");
  const [provinceId, setProvinceId] = useState<number | "">("");
  const [districtId, setDistrictId] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [beyanYuku, setBeyanYuku] = useState<number | "">("");
  const [beyanHizi, setBeyanHizi] = useState("");
  const [katAdedi, setKatAdedi] = useState("");
  const [durakAdedi, setDurakAdedi] = useState("");
  const [imalYili, setImalYili] = useState("");
  const [askiTipi, setAskiTipi] = useState("");
  const [katKapisi, setKatKapisi] = useState("");
  // ek belge alanları
  const [pafta, setPafta] = useState("");
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [yapiSahibi, setYapiSahibi] = useState("");
  const [yapiSahibiAdresi, setYapiSahibiAdresi] = useState("");
  const [asansorSeriNo, setAsansorSeriNo] = useState("");
  const [asansorKimlikNo, setAsansorKimlikNo] = useState("");
  const [seyirMesafesi, setSeyirMesafesi] = useState("");
  const [motorSeriNo, setMotorSeriNo] = useState("");
  const [motorGucu, setMotorGucu] = useState("");
  // ekipman seçimi: category_id -> { brandId, modelId }
  const [equip, setEquip] = useState<Record<string, { brandId?: string; modelId?: string }>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const lookupGroups = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const l of props.lookups) (g[l.list_key] ||= []).push(l.value);
    return g;
  }, [props.lookups]);

  const company = props.companies.find((c) => c.id === companyId) || null;

  const kisi = useMemo(() => {
    if (beyanYuku === "") return null;
    return props.capacity.find((c) => c.beyan_yuku_kg === beyanYuku)?.kisi_sayisi ?? null;
  }, [beyanYuku, props.capacity]);

  const certById = useMemo(() => {
    const m = new Map<string, Certificate>();
    props.certificates.forEach((c) => m.set(c.id, c));
    return m;
  }, [props.certificates]);
  const nbById = useMemo(() => {
    const m = new Map<string, NotifiedBody>();
    props.notifiedBodies.forEach((n) => m.set(n.id, n));
    return m;
  }, [props.notifiedBodies]);

  async function onProvinceChange(idStr: string) {
    const id = idStr ? Number(idStr) : "";
    setProvinceId(id);
    setDistrictId("");
    setDistricts([]);
    if (id !== "") {
      const { data } = await supabase
        .from("districts")
        .select("id, name")
        .eq("province_id", id)
        .order("name")
        .limit(2000);
      setDistricts(data ?? []);
    }
  }

  function pickBrand(catId: string, brandId: string) {
    setEquip((e) => ({ ...e, [catId]: { brandId, modelId: undefined } }));
  }
  function pickModel(catId: string, modelId: string) {
    setEquip((e) => ({ ...e, [catId]: { ...e[catId], modelId } }));
  }

  const selectedEquipCount = Object.values(equip).filter((e) => e.modelId).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const equipment = Object.entries(equip)
      .filter(([, v]) => v.modelId)
      .map(([category_id, v]) => {
        const model = props.models.find((m) => m.id === v.modelId);
        return {
          category_id,
          slot: "main",
          brand_id: v.brandId ?? null,
          model_id: v.modelId ?? null,
          certificate_id: model?.certificate_id ?? null,
        };
      });

    const payload: DraftPayload = {
      company_id: companyId,
      dosya_no: dosyaNo,
      dosya_tarihi: dosyaTarihi || null,
      bina_adi: binaAdi || null,
      montaj_adresi: montajAdresi || null,
      province_id: provinceId === "" ? null : provinceId,
      district_id: districtId || null,
      beyan_yuku_kg: beyanYuku === "" ? null : beyanYuku,
      kisi_sayisi: kisi,
      beyan_hizi: beyanHizi ? Number(beyanHizi) : null,
      kat_adedi: katAdedi ? Number(katAdedi) : null,
      durak_adedi: durakAdedi ? Number(durakAdedi) : null,
      imal_yili: imalYili ? Number(imalYili) : null,
      input_data: {
        aski_tipi: askiTipi,
        kat_kapisi: katKapisi,
        montaj_adresi: montajAdresi,
        pafta,
        ada,
        parsel,
        yapi_sahibi: yapiSahibi,
        yapi_sahibi_adresi: yapiSahibiAdresi,
        asansor_seri_no: asansorSeriNo,
        asansor_kimlik_no: asansorKimlikNo,
        seyir_mesafesi: seyirMesafesi,
        motor_seri_no: motorSeriNo,
        motor_gucu: motorGucu,
      },
      equipment,
    };

    const res = await saveDraftProject(payload);
    setSaving(false);
    if (res.ok) {
      setSavedId(res.id);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  // ---- Başarı ekranı ----
  if (savedId) {
    return (
      <div className="p-7 max-w-2xl">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 grid place-items-center text-3xl mx-auto mb-4">
            ✓
          </div>
          <h1 className="text-xl font-extrabold mb-1">Taslak kaydedildi</h1>
          <p className="text-slate-500 mb-6">
            {dosyaNo} numaralı teknik dosya taslağı oluşturuldu.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/panel")}
              className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-lg"
            >
              Panele dön
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-100 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-lg"
            >
              Yeni dosya
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canNext =
    (step === 0 && companyId && dosyaNo) ||
    step === 1 ||
    step === 2 ||
    step === 3 ||
    step === 4;

  return (
    <div>
      {/* Üst bar */}
      <div className="bg-white border-b border-slate-200 px-7 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-sm text-slate-500">
          Yeni Teknik Dosya › <b className="text-slate-900">{STEPS[step]}</b>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm font-bold px-4 py-2 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            Geri
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canNext}
              className="text-sm font-bold px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-40"
            >
              İleri →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !companyId || !dosyaNo}
              className="text-sm font-bold px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-40"
            >
              {saving ? "Kaydediliyor…" : "Taslağı Kaydet ✓"}
            </button>
          )}
        </div>
      </div>

      {/* İçerik */}
      <div className="p-7 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-w-6xl">
        <div className="min-w-0">
          {/* Adım göstergesi */}
          <div className="flex gap-2 mb-5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full ${
                  i < step ? "bg-green-500" : i === step ? "bg-brand" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <Section title="Firma seçimi" desc="Firmayı seçince bilgileri otomatik gelir.">
              <Field label="Montaj / Mimarlık Firması">
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="inp"
                >
                  <option value="">Firma seçiniz…</option>
                  {props.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Dosya No">
                  <input className="inp" value={dosyaNo} onChange={(e) => setDosyaNo(e.target.value)} placeholder="TD-2026-0001" />
                </Field>
                <Field label="Tarih">
                  <input type="date" className="inp" value={dosyaTarihi} onChange={(e) => setDosyaTarihi(e.target.value)} />
                </Field>
              </div>
              {company && (
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Otomatik dolan bilgiler
                  </div>
                  <AutoRow k="Ünvan" v={company.legal_name} />
                  <AutoRow k="Adres" v={company.address} />
                  <AutoRow k="Telefon" v={company.phone} />
                  <AutoRow k="Şehir" v={company.city} />
                  <AutoRow k="Yetkili" v={company.authorized_person} />
                  <AutoRow k="Tescilli marka" v={company.registered_brand} />
                  <AutoRow k="Sanayi sicil no" v={company.industry_reg_no} />
                </div>
              )}
            </Section>
          )}

          {step === 1 && (
            <Section title="Yapı ruhsatı bilgileri" desc="Bina ve konum bilgileri.">
              <Field label="Bina Adı">
                <input className="inp" value={binaAdi} onChange={(e) => setBinaAdi(e.target.value)} />
              </Field>
              <Field label="Montaj Adresi">
                <input className="inp" value={montajAdresi} onChange={(e) => setMontajAdresi(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="İl">
                  <select className="inp" value={provinceId} onChange={(e) => onProvinceChange(e.target.value)}>
                    <option value="">İl seçiniz…</option>
                    {props.provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Belediye">
                  <select className="inp" value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={districts.length === 0}>
                    <option value="">{provinceId === "" ? "Önce il seçin" : "Belediye seçiniz…"}</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Pafta">
                  <input className="inp" value={pafta} onChange={(e) => setPafta(e.target.value)} />
                </Field>
                <Field label="Ada">
                  <input className="inp" value={ada} onChange={(e) => setAda(e.target.value)} />
                </Field>
                <Field label="Parsel">
                  <input className="inp" value={parsel} onChange={(e) => setParsel(e.target.value)} />
                </Field>
              </div>
              <Field label="Yapı Sahibi">
                <input className="inp" value={yapiSahibi} onChange={(e) => setYapiSahibi(e.target.value)} />
              </Field>
              <Field label="Yapı Sahibi Adresi">
                <input className="inp" value={yapiSahibiAdresi} onChange={(e) => setYapiSahibiAdresi(e.target.value)} />
              </Field>
            </Section>
          )}

          {step === 2 && (
            <Section title="Asansör teknik bilgileri" desc="Kişi sayısı beyan yüküne göre otomatik gelir.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Beyan Yükü (kg)">
                  <select className="inp" value={beyanYuku} onChange={(e) => setBeyanYuku(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Seçiniz…</option>
                    {props.capacity.map((c) => (
                      <option key={c.beyan_yuku_kg} value={c.beyan_yuku_kg}>
                        {c.beyan_yuku_kg}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Kişi Sayısı (otomatik)">
                  <input className="inp bg-slate-100" value={kisi ?? ""} disabled />
                </Field>
                <Field label="Beyan Hızı (m/s)">
                  <select className="inp" value={beyanHizi} onChange={(e) => setBeyanHizi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {(lookupGroups["beyan_hizi"] ?? ["0.63", "1", "1.6"]).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="İmal Yılı">
                  <input className="inp" value={imalYili} onChange={(e) => setImalYili(e.target.value)} placeholder="2026" />
                </Field>
                <Field label="Kat Adedi">
                  <input className="inp" value={katAdedi} onChange={(e) => setKatAdedi(e.target.value)} />
                </Field>
                <Field label="Durak Adedi">
                  <input className="inp" value={durakAdedi} onChange={(e) => setDurakAdedi(e.target.value)} />
                </Field>
                <Field label="Askı Tipi">
                  <select className="inp" value={askiTipi} onChange={(e) => setAskiTipi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {(lookupGroups["aski_tipi"] ?? ["1/1", "1/2", "2/1"]).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Kat Kapısı">
                  <select className="inp" value={katKapisi} onChange={(e) => setKatKapisi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {(lookupGroups["kat_kapisi"] ?? ["Otomatik Merkezi", "Otomatik Yandan"]).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Asansör Seri No">
                  <input className="inp" value={asansorSeriNo} onChange={(e) => setAsansorSeriNo(e.target.value)} />
                </Field>
                <Field label="Asansör Kimlik No">
                  <input className="inp" value={asansorKimlikNo} onChange={(e) => setAsansorKimlikNo(e.target.value)} />
                </Field>
                <Field label="Seyir Mesafesi (m)">
                  <input className="inp" value={seyirMesafesi} onChange={(e) => setSeyirMesafesi(e.target.value)} />
                </Field>
                <Field label="Motor Seri No">
                  <input className="inp" value={motorSeriNo} onChange={(e) => setMotorSeriNo(e.target.value)} />
                </Field>
                <Field label="Motor Gücü (kW)">
                  <input className="inp" value={motorGucu} onChange={(e) => setMotorGucu(e.target.value)} />
                </Field>
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section title="Kritik ekipmanlar" desc="Önce marka, sonra model. Sertifika otomatik bağlanır.">
              <div className="space-y-4">
                {props.categories.map((cat) => {
                  const catBrands = props.brands.filter((b) => b.category_id === cat.id);
                  const sel = equip[cat.id] || {};
                  const catModels = sel.brandId
                    ? props.models.filter((m) => m.brand_id === sel.brandId)
                    : [];
                  const model = props.models.find((m) => m.id === sel.modelId);
                  const cert = model?.certificate_id ? certById.get(model.certificate_id) : undefined;
                  const nb = cert?.notified_body_id ? nbById.get(cert.notified_body_id) : undefined;
                  return (
                    <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="font-bold mb-2">{cat.name}</div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Marka</div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {catBrands.map((b) => (
                          <Chip key={b.id} active={sel.brandId === b.id} onClick={() => pickBrand(cat.id, b.id)}>
                            {b.name}
                          </Chip>
                        ))}
                      </div>
                      {sel.brandId && (
                        <>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Model</div>
                          <div className="flex flex-wrap gap-2">
                            {catModels.map((m) => (
                              <Chip key={m.id} active={sel.modelId === m.id} onClick={() => pickModel(cat.id, m.id)}>
                                {m.name}
                              </Chip>
                            ))}
                          </div>
                        </>
                      )}
                      {cert && (
                        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Sertifika No</span>
                            <span className="font-semibold">{cert.cert_no}</span>
                          </div>
                          {nb && (
                            <div className="flex justify-between mt-1">
                              <span className="text-slate-500">Onaylanmış Kuruluş</span>
                              <span className="font-semibold">
                                {nb.identity_no} · {nb.name}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {step === 4 && (
            <Section title="Önizleme" desc="Bilgileri kontrol edip taslağı kaydet.">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <SummRow k="Firma" v={company?.short_name} />
                <SummRow k="Dosya No" v={dosyaNo} />
                <SummRow k="Bina" v={binaAdi} />
                <SummRow k="Kapasite" v={beyanYuku ? `${beyanYuku} kg · ${kisi ?? "—"} kişi` : "—"} />
                <SummRow k="Kat / Durak" v={`${katAdedi || "—"} / ${durakAdedi || "—"}`} />
                <SummRow k="Seçili ekipman" v={`${selectedEquipCount} kategori`} />
              </div>
              {error && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Sağ özet paneli */}
        <div className="hidden lg:block">
          <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-3">Özet</div>
            <SummRow k="Firma" v={company?.short_name} />
            <SummRow k="Dosya No" v={dosyaNo} />
            <SummRow k="İl" v={props.provinces.find((p) => p.id === provinceId)?.name} />
            <SummRow k="Kapasite" v={beyanYuku ? `${beyanYuku} kg` : "—"} />
            <SummRow k="Ekipman" v={`${selectedEquipCount} seçildi`} />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .inp {
          width: 100%;
          font-size: 14px;
          padding: 11px 12px;
          border: 1.5px solid var(--line);
          border-radius: 10px;
          background: #fff;
        }
        .inp:focus {
          outline: none;
          border-color: #0d8b8b;
          box-shadow: 0 0 0 3px #e6f4f4;
        }
      `}</style>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-extrabold mb-1">{title}</h1>
      {desc && <p className="text-slate-500 text-sm mb-4">{desc}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
        active ? "bg-brand border-brand text-white" : "bg-white border-slate-200 text-slate-700 hover:border-brand hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
function AutoRow({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-right">{v || "—"}</span>
    </div>
  );
}
function SummRow({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-right">{v || "—"}</span>
    </div>
  );
}
