import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Path } from "@react-pdf/renderer";
import { TEKNIK_DOSYA_BELGELERI } from "./belgeler";
import { KULLANIM_KLAVUZU, BAKIM_KLAVUZU, SON_KONTROL } from "./belge_icerik";
import { KULLANIM_KLAVUZU_HID, BAKIM_KLAVUZU_HID } from "./belge_icerik_hidrolik";

// Birleşik Teknik Dosya — belgeleri tek PDF'te birleştirir VEYA tek belge üretir (only).
// Veri = project_render_context (jsonb). Font 'Roboto' route'ta register edilir.

const NAVY = "#1e2a5b";
const TEAL = "#0d8b8b";

const st = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 10, color: "#1f2937", padding: 42, paddingBottom: 60, lineHeight: 1.45 },
  topRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: "#6b7280", marginBottom: 10 },
  firmaName: { fontSize: 13, fontWeight: "bold", color: NAVY },
  firmaSub: { fontSize: 9, color: "#6b7280", marginBottom: 14 },
  docTitle: { fontSize: 15, fontWeight: "bold", color: NAVY, textAlign: "center", marginTop: 4 },
  rule: { borderBottomWidth: 2, borderBottomColor: TEAL, width: 110, alignSelf: "center", marginTop: 4, marginBottom: 16 },
  sec: { fontSize: 10.5, fontWeight: "bold", color: TEAL, marginTop: 12, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3 },
  row: { flexDirection: "row", paddingVertical: 2.2 },
  lbl: { width: "42%", color: "#6b7280" },
  val: { width: "58%", fontWeight: "bold", color: "#111827" },
  p: { textAlign: "justify", marginBottom: 8 },
  eqRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9" },
  eqA: { width: "30%", color: "#6b7280" },
  eqB: { width: "40%", fontWeight: "bold" },
  eqC: { width: "30%", fontSize: 9 },
  signWrap: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  signBox: { width: "45%" },
  signLine: { borderTopWidth: 0.5, borderTopColor: "#9ca3af", marginTop: 34, paddingTop: 4, fontSize: 9, color: "#6b7280" },
  listRow: { flexDirection: "row", paddingVertical: 2 },
  listNo: { width: 22, color: TEAL, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, fontSize: 8, color: "#9ca3af", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
  coverWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverBig: { fontSize: 26, fontWeight: "bold", color: NAVY, marginBottom: 14, lineHeight: 1.1, textAlign: "center" },
  coverSub: { fontSize: 13, color: TEAL, marginBottom: 40, textAlign: "center" },
  klvItem: { flexDirection: "row", paddingVertical: 2, fontSize: 9.5 },
  klvNo: { width: 22, color: TEAL },
  klvText: { flex: 1, textAlign: "justify" },
  skHead: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 3, paddingHorizontal: 2, fontSize: 8.5, fontWeight: "bold", color: NAVY },
  skRow: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9", fontSize: 8.5 },
  skNo: { width: 20, color: "#94a3b8" },
  skItem: { flex: 1, paddingRight: 4 },
  skBox: { width: 44, alignItems: "center" },
  skSquare: { width: 11, height: 11, borderWidth: 0.8, borderColor: "#9ca3af", borderRadius: 2 },

  // Resmi form (EK-1 / EK-3 / Taahhütname) — kutulu, keskin köşeli, koyu kenarlık
  // Resmi form için daraltılmış sayfa (tek sayfaya sığması için)
  pageForm: { fontFamily: "Roboto", fontSize: 8, color: "#1f2937", paddingTop: 26, paddingHorizontal: 32, paddingBottom: 34, lineHeight: 1.25 },
  formTitle: { textAlign: "center", fontWeight: "bold", fontSize: 12, color: "#0f172a", marginBottom: 1 },
  formSub: { textAlign: "center", fontSize: 8.5, color: "#475569", marginBottom: 6 },
  fBox: { borderTopWidth: 0.8, borderLeftWidth: 0.8, borderRightWidth: 0.8, borderColor: "#334155" },
  fRow: { flexDirection: "row", borderBottomWidth: 0.8, borderColor: "#334155" },
  fLabel: { width: "46%", paddingVertical: 1.8, paddingHorizontal: 4, fontSize: 7.3, fontWeight: "bold", color: "#1f2937", borderRightWidth: 0.8, borderColor: "#334155" },
  fVal: { flex: 1, paddingVertical: 1.8, paddingHorizontal: 4, fontSize: 7.3, color: "#111827" },
  fSection: { paddingVertical: 2, paddingHorizontal: 4, fontSize: 7.6, fontWeight: "bold", color: "#0f172a", backgroundColor: "#e5e9f0", textAlign: "center", borderBottomWidth: 0.8, borderColor: "#334155" },
  fColHead: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 0.8, borderColor: "#334155" },
  fc1: { width: "40%", paddingVertical: 1.8, paddingHorizontal: 4, fontSize: 6.9, fontWeight: "bold", borderRightWidth: 0.8, borderColor: "#334155" },
  fc2: { width: "22%", paddingVertical: 1.8, paddingHorizontal: 3, fontSize: 6.9, fontWeight: "bold", borderRightWidth: 0.8, borderColor: "#334155", textAlign: "center" },
  fc3: { width: "22%", paddingVertical: 1.8, paddingHorizontal: 3, fontSize: 6.9, fontWeight: "bold", borderRightWidth: 0.8, borderColor: "#334155", textAlign: "center" },
  fc4: { flex: 1, paddingVertical: 1.8, paddingHorizontal: 3, fontSize: 6.9, fontWeight: "bold", textAlign: "center" },
  // Genel tablo (Marka/Tip/Model.. ve Seyir Defteri tabloları)
  tbl: { borderTopWidth: 0.6, borderLeftWidth: 0.6, borderColor: "#94a3b8", marginTop: 4 },
  trow: { flexDirection: "row" },
  thcell: { paddingVertical: 3, paddingHorizontal: 4, fontSize: 7.4, fontWeight: "bold", color: "#0f172a", backgroundColor: "#e5e9f0", borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: "#94a3b8" },
  tcell: { paddingVertical: 3, paddingHorizontal: 4, fontSize: 8, color: "#111827", borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: "#94a3b8" },
  tcellTall: { paddingVertical: 3, paddingHorizontal: 4, fontSize: 8, minHeight: 20, borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: "#94a3b8" },
  ckbox: { width: 11, height: 11, borderWidth: 0.9, borderColor: "#334155", borderRadius: 2, marginRight: 8 },

  // Teknik & Komponent Listesi (Excel birebir, tek sayfa)
  kPage: { fontFamily: "Roboto", fontSize: 8, color: "#111827", paddingTop: 26, paddingHorizontal: 30, paddingBottom: 30, lineHeight: 1.2 },
  kTitle: { textAlign: "center", fontWeight: "bold", fontSize: 11, color: "#0f172a", marginBottom: 8 },
  kInfoRow: { flexDirection: "row", paddingVertical: 0.8 },
  kLbl: { width: "26%", fontSize: 7.6, fontWeight: "bold", color: "#1f2937" },
  kSep: { width: "3%", fontSize: 7.6 },
  kVal: { flex: 1, fontSize: 7.6, color: "#111827" },
  kSub: { width: "26%", fontSize: 7.6, color: "#1f2937", paddingLeft: 10 },
  kTbl: { borderTopWidth: 0.6, borderLeftWidth: 0.6, borderColor: "#334155", marginTop: 7 },
  kRow: { flexDirection: "row" },
  kH: { fontSize: 6, fontWeight: "bold", backgroundColor: "#e5e9f0", color: "#0f172a", paddingVertical: 3, paddingHorizontal: 2, borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: "#334155", textAlign: "center" },
  kC: { fontSize: 6.4, paddingVertical: 2.4, paddingHorizontal: 2, borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: "#334155" },
  kCol: { borderRightWidth: 0.6, borderColor: "#334155" },
  kSubC: { fontSize: 6.4, paddingVertical: 2.4, paddingHorizontal: 2, borderBottomWidth: 0.6, borderColor: "#334155" },
});

// Teknik & Komponent tablosu kolon genişlikleri (Excel ile aynı sıra)
const KW = { ad: "26%", kat: "8%", marka: "14%", tip: "14%", seri: "14%", sert: "12%", kur: "12%" };

// Resmi form yardımcıları
function FRow({ l, val }: { l: string; val?: any }) {
  return (
    <View style={st.fRow}>
      <Text style={st.fLabel}>{l}</Text>
      <Text style={st.fVal}>{val !== undefined && val !== null && String(val).trim() !== "" ? String(val) : ""}</Text>
    </View>
  );
}
function FSection({ children }: { children: any }) {
  return <Text style={st.fSection}>{children}</Text>;
}

// Mühendis Taahhütnamesi — Makine / Elektrik için ayrı sayfa (aynı düzen)
function taahhutPage(c: any, disc: "makine" | "elektrik") {
  const m = disc === "makine" ? c.muh?.makine : c.muh?.elektrik;
  const unvan = disc === "makine" ? "MAKİNA MÜHENDİSİ" : "ELEKTRİK MÜHENDİSİ";
  const unvanKisa = disc === "makine" ? "Mak.Müh." : "Elk.Müh.";
  return (
    <Page key={"muh_taahhut_" + disc} size="A4" style={st.page}>
      <Text style={st.formTitle}>TAAHHÜTNAME</Text>
      <Text style={st.formSub}>{unvan}</Text>
      <View style={st.fBox}>
        <FSection>PROJE MÜELLİFİ</FSection>
        <FRow l="Oda Sicil No" val={m?.oda_sicil} />
        <FRow l="Unvanı" val={unvan} />
        <FRow l="Adresi" val={m?.adres} />
        <FRow l="Telefonu" val={m?.telefon} />
        <FSection>MÜELLİFLİĞİ ÜSTLENİLEN PROJE</FSection>
        <FRow l="İl / İlçe" val={[c.d.il, c.d.belediye].filter(Boolean).join(" / ")} />
        <FRow l="İlgili İdare" val={c.d.belediye ? `${v(c.d.belediye)} Belediyesi` : ""} />
        <FRow l="Pafta / Ada / Parsel No" val={[c.inp.pafta, c.inp.ada, c.inp.parsel].filter(Boolean).join(" / ")} />
        <FRow l="Yapı Adresi" val={c.d.montaj_adresi} />
        <FRow l="Yapı Sahibi" val={c.inp.yapi_sahibi} />
        <FRow l="Yapı Sahibinin Adresi" val={c.inp.yapi_sahibi_adresi} />
        <FRow l="Projenin Türü" val={c.projeTuru} />
      </View>
      <Text style={{ fontSize: 8.6, marginTop: 10, textAlign: "justify", lineHeight: 1.5 }}>
        Yukarıdaki bilgilere sahip projenin müellifliğini üstlenmemde 6235 sayılı Türk Mühendis ve Mimar Odaları Birliği Kanunu, 3194 sayılı İmar Kanunu ve ilgili mevzuat kapsamında süreli veya süresiz olarak mesleki faaliyet haklarımda herhangi bir kısıtlılık bulunmadığını, Yukarıdaki bilgilere sahp yapıya ilişkin hazırlanacak tüm projelerde, 3194 sayılı Kanun ve deprem, yangın,enerji verimliliği,asansör gibi ilgili tüm mevzuat hükümlerini eksiksiz uygulayacağımı taahhüt ederim.
      </Text>
      <View style={{ marginTop: 30, alignSelf: "flex-end", width: "60%" }}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <View style={{ marginRight: 16, alignItems: "center" }}>
            <Text style={{ fontSize: 9.5, fontWeight: "bold", marginBottom: 6 }}>Proje Müellifi</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 5 }}>{unvanKisa}</Text>
            <Text style={{ fontSize: 9, marginBottom: 5 }}>{v(m?.ad)}</Text>
            <Text style={{ fontSize: 9 }}>Oda Sicil No: {v(m?.oda_sicil)}</Text>
          </View>
          <View style={{ minWidth: 68, paddingTop: 21 }}>
            <Text style={{ fontSize: 9, marginBottom: 5 }}>Adı-Soyadı</Text>
            <Text style={{ fontSize: 9, marginBottom: 5 }}>Ünvanı</Text>
            <Text style={{ fontSize: 9 }}>İmza</Text>
          </View>
        </View>
      </View>
      <Text style={{ fontSize: 7.6, marginTop: 16, textAlign: "justify", color: "#475569", lineHeight: 1.45 }}>
        Gerçeğe aykırı beyanda bulunduğu tespit edilenlerin işlemleri iptal edilecek ve bu kişiler hakkında 5237 sayılı Türk Ceza Kanununun ilgili hükümleri gereği Cumhuriyet Savcılığına suç duyurusunda bulunulacak, ayrıca 6235 sayılı Türk Mühendis ve Mimar Odaları Birliği Kanunu ve ilgili mevzuatı uyarınca işlem yapılmak üzere ilgili Meslek Odasına bilgi verilecektir.
      </Text>
      <Footer firma={c.fname} />
    </Page>
  );
}

// ---- Teknik & Komponent Listesi (Excel '10-Teknik &Komponent Listesi' formatı, tek sayfa) ----
const vb = (x: any) => (x !== undefined && x !== null && String(x).trim() !== "" ? String(x) : "");
const ebat = (a: any, b: any) => (vb(a) && vb(b) ? `${vb(a)} x ${vb(b)}` : "");

// Hücreye sığmayan uzun metinlerde (sertifika/seri no) fontu otomatik küçült.
// A4 içerik genişliği ≈ 535pt; sütun yüzdesine göre kalan alana göre ölçekler.
const fitFs = (s: any, widthPct: number, base = 6.4, min = 4.2) => {
  const txt = vb(s);
  if (!txt) return base;
  const contentW = 535 * (widthPct / 100) - 5;
  const est = txt.length * base * 0.5; // ortalama karakter genişliği ≈ 0.5em
  if (est <= contentW) return base;
  return Math.max(min, (base * contentW) / est);
};

function KInfo({ l, val, unit, sub }: { l: string; val?: any; unit?: string; sub?: boolean }) {
  const s = vb(val);
  return (
    <View style={st.kInfoRow}>
      <Text style={sub ? st.kSub : st.kLbl}>{l}</Text>
      <Text style={st.kSep}>:</Text>
      <Text style={st.kVal}>{s ? (unit ? `${s} ${unit}` : s) : ""}</Text>
    </View>
  );
}
function KSection({ children }: { children: any }) {
  return <Text style={{ fontSize: 7.8, fontWeight: "bold", marginTop: 3 }}>{children}</Text>;
}

// Çok satırlı komponent bloğu: seri no alt satır satır, diğer sütunlar birleşik
function KBlok({ ad, e, alt }: { ad: string; e: any; alt: { ad: string; seri: string }[] }) {
  const son = alt.length - 1;
  const kurulus = [e?.kurulus_no, e?.onaylanmis_kurulus].filter(Boolean).join(" ");
  return (
    <View style={[st.kRow, { borderBottomWidth: 0.6, borderColor: "#334155" }]}>
      <View style={[st.kCol, { width: KW.ad, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: fitFs(ad, 26) }}>{ad}</Text>
      </View>
      <View style={[st.kCol, { width: KW.kat }]}>
        {alt.map((k, i) => (
          <Text key={i} style={[st.kSubC, { fontSize: fitFs(k.ad, 8) }, i === son ? { borderBottomWidth: 0 } : {}]}>{k.ad}</Text>
        ))}
      </View>
      <View style={[st.kCol, { width: KW.marka, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: fitFs(e?.marka, 14) }}>{vb(e?.marka)}</Text>
      </View>
      <View style={[st.kCol, { width: KW.tip, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: fitFs(e?.model, 14) }}>{vb(e?.model)}</Text>
      </View>
      <View style={[st.kCol, { width: KW.seri }]}>
        {alt.map((k, i) => (
          <Text key={i} style={[st.kSubC, { fontSize: fitFs(k.seri, 14) }, i === son ? { borderBottomWidth: 0 } : {}]}>{k.seri}</Text>
        ))}
      </View>
      <View style={[st.kCol, { width: KW.sert, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: fitFs(e?.sertifika_no, 12) }}>{vb(e?.sertifika_no)}</Text>
      </View>
      <View style={{ width: KW.kur, justifyContent: "center", paddingHorizontal: 2 }}>
        <Text style={{ fontSize: fitFs(kurulus, 12) }}>{kurulus}</Text>
      </View>
    </View>
  );
}

function teknikKomponentPage(c: any) {
  const eq = c.ekipman || {};
  const kk = eq.kapi_kilidi || {};
  const katSeri: string[] = Array.isArray(kk.seri_list) ? kk.seri_list.map((x: any) => (x == null ? "" : String(x))) : [];
  const durak = Number(c.d.durak_adedi || 0) || katSeri.length;
  const n = Math.max(durak, katSeri.length, 1);
  // Kat etiketleri: veri girişindeki kat listesi (B/Z/1..) varsa onu kullan
  const katAdlari: string[] = Array.isArray(c.inp.kat_listesi) ? c.inp.kat_listesi.map((x: any) => String(x)) : [];
  const katlar = Array.from({ length: n }, (_, i) => ({
    ad: katAdlari[i] ? `${katAdlari[i]}` : `${i + 1}.KAT`,
    seri: katSeri[i] || "",
  }));
  // Kabin kapı kilidi: giriş başına ayrı seri no (kat kilidiyle aynı mantık)
  const kbk = eq.kabin_kilidi || {};
  const girisSeri: string[] = Array.isArray(kbk.seri_list) ? kbk.seri_list.map((x: any) => (x == null ? "" : String(x))) : [];
  const girisN = Math.max(Number(c.inp.giris_sayisi || 0) || 0, girisSeri.length);
  const girisler = girisN > 0
    ? Array.from({ length: girisN }, (_, i) => ({ ad: `${i + 1}.GİRİŞ`, seri: girisSeri[i] || "" }))
    : [{ ad: "1.GİRİŞ", seri: vb(kbk.seri_no) }];
  const aski = String(c.inp.aski_tipi || "").trim();
  // Yukarı yön aşırı hızlanma: askı 1/1 ise fren bloğu, 2/1/4/1 ise makine motoru
  const yukari = aski.startsWith("1/1") ? (eq.fren_blogu || {}) : (eq.motor || {});
  const kurulus = (e: any) => [e?.kurulus_no, e?.onaylanmis_kurulus].filter(Boolean).join(" ");
  const satirlar: [string, any][] = [
    ["Aşırı Hız Sınırlayıcı Tertibat", eq.hiz_regulatoru],
    ["Kabin Güvenlik Tertibatı", eq.fren_blogu],
    ["Kabin Tamponu", eq.tampon_kabin || eq.tampon],
    ["Ağırlık Tamponu", eq.tampon_agirlik],
    ["Elektronik Aksam İçeren Güvenlik Tertibatı", eq.kumanda],
    ["Yukarı Yön Aşırı Hızlanma Önleme Tertibat", yukari],
  ];
  const son = katlar.length - 1;

  return (
    <Page key="teknik_komponent" size="A4" style={st.kPage}>
      <Text style={st.kTitle}>ASANSÖR TEKNİK ÖZELLİKLERİ &amp; GÜVENLİK EKİPMANLARI LİSTESİ</Text>

      <KInfo l="ASANSÖR SERİ NO" val={c.inp.asansor_seri_no} />
      <KInfo l="ASANSÖRÜN TİPİ" val={c.inp.asansor_sinifi || c.asansorTuru} />
      <KInfo l="YAPIM YILI" val={c.d.imal_yili} />
      <KInfo l="SEYİR MESAFESİ" val={c.inp.seyir_mesafesi} unit="m." />
      <KInfo l="BEYAN YÜKÜ" val={c.d.beyan_yuku_kg} unit="Kg." />
      <KInfo l="BEYAN HIZI" val={c.d.beyan_hizi} unit="m/s" />
      <KInfo l="ASKI TİPİ" val={c.inp.aski_tipi} />
      <KInfo l="KAT ADEDİ" val={c.d.kat_adedi} />
      <KInfo l="DURAK ADEDİ" val={c.d.durak_adedi} />

      <KSection>KAT KAPILARI</KSection>
      <KInfo sub l="Tipi" val={c.inp.kat_kapisi} />
      <KInfo sub l="Ebatlar" val={ebat(c.inp.kapi_genislik, c.inp.kapi_yukseklik)} unit="mm." />

      <KSection>KABİN</KSection>
      <KInfo sub l="Tipi" val={c.inp.kabin_tipi} />
      <KInfo sub l="Ebatları" val={ebat(c.inp.kabin_genislik, c.inp.kabin_derinlik)} unit="mm." />
      <KInfo sub l="Ağırlığı" val={c.inp.kabin_agirligi || c.kap?.kabin_agirlik} unit="Kg." />

      {!c.isHid && (
        <>
          <KSection>KARŞI AĞIRLIK</KSection>
          <KInfo sub l="Yeri" val={c.inp.karsi_agirlik_yeri} />
          <KInfo sub l="Ağırlığı" val={c.inp.karsi_agirlik_agirligi || c.kap?.karsi_agirlik} unit="Kg." />
        </>
      )}

      {c.isHid ? (
        <>
          <KSection>ÜNİTE / PİSTON</KSection>
          <KInfo sub l="Motor / Ünite Markası" val={c.inp.motor_marka} />
          <KInfo sub l="Motor Gücü" val={c.inp.motor_gucu} unit="kW" />
          <KInfo sub l="Ünite Bilgisi" val={c.inp.unite_bilgisi} />
          <KInfo sub l="Piston Ölçüleri" val={c.inp.piston_olculeri} unit="mm." />
          <KInfo sub l="Piston Yeri" val={c.inp.piston_yeri} />
          <KInfo sub l="Debi" val={c.inp.debi} unit="l/d" />
        </>
      ) : (
        <>
          <KSection>MAKİNE – MOTOR</KSection>
          <KInfo sub l="Markası" val={[eq.motor?.marka, eq.motor?.model].filter(Boolean).join(" ")} />
          <KInfo sub l="Gücü" val={c.inp.motor_gucu} unit="kW" />
          <KInfo sub l="Seri No" val={eq.motor?.seri_no} />
        </>
      )}

      <View style={st.kTbl}>
        <View style={st.kRow}>
          <Text style={[st.kH, { width: "34%" }]}>KULLANILAN GÜVENLİK KOMPONENTİ</Text>
          <Text style={[st.kH, { width: KW.marka }]}>MARKASI</Text>
          <Text style={[st.kH, { width: KW.tip }]}>TİPİ</Text>
          <Text style={[st.kH, { width: KW.seri }]}>SERİ NO</Text>
          <Text style={[st.kH, { width: KW.sert }]}>SERTİFİKA NO</Text>
          <Text style={[st.kH, { width: KW.kur }]}>VEREN ONAYLANMIŞ KURULUŞ</Text>
        </View>

        {/* Kilitleme tertibatları — seri no kat/giriş bazında satır satır */}
        <KBlok ad="Durak Kapısı Kilitleme Tertibatı" e={kk} alt={katlar} />
        <KBlok ad="Kabin Kapısı Kilitleme Tertibatı" e={kbk} alt={girisler} />

        {satirlar.map(([ad, e], i) => (
          <View style={st.kRow} key={i}>
            <Text style={[st.kC, { width: "34%", fontSize: fitFs(ad, 34) }]}>{ad}</Text>
            <Text style={[st.kC, { width: KW.marka, fontSize: fitFs(e?.marka, 14) }]}>{vb(e?.marka)}</Text>
            <Text style={[st.kC, { width: KW.tip, fontSize: fitFs(e?.model, 14) }]}>{vb(e?.model)}</Text>
            <Text style={[st.kC, { width: KW.seri, fontSize: fitFs(e?.seri_no, 14) }]}>{vb(e?.seri_no)}</Text>
            <Text style={[st.kC, { width: KW.sert, fontSize: fitFs(e?.sertifika_no, 12) }]}>{vb(e?.sertifika_no)}</Text>
            <Text style={[st.kC, { width: KW.kur, fontSize: fitFs(kurulus(e), 12) }]}>{kurulus(e)}</Text>
          </View>
        ))}
      </View>

      <Footer firma={c.fname} />
    </Page>
  );
}

const CAT_LABEL: Record<string, string> = {
  hiz_regulatoru: "Hız Regülatörü", tampon: "Tampon", tampon_kabin: "Kabin Tamponu",
  tampon_agirlik: "Ağırlık Tamponu", kapi_kilidi: "Kapı Kilidi", kabin_kilidi: "Kabin Kapı Kilidi",
  fren_blogu: "Fren Bloğu", kumanda: "Kumanda Panosu", motor: "Makine Motoru",
};

function BsMadde({ no, baslik, children }: { no: number | string; baslik: string; children: any }) {
  return (
    <View style={{ marginTop: 7 }}>
      <Text style={{ fontWeight: "bold", color: "#1e2a5b", fontSize: 9 }}>{`MADDE ${no} – ${baslik}`}</Text>
      {typeof children === "string"
        ? <Text style={{ textAlign: "justify", fontSize: 8.6, lineHeight: 1.35, marginTop: 2 }}>{children}</Text>
        : children}
    </View>
  );
}
const bsP = { textAlign: "justify" as const, fontSize: 8.6, lineHeight: 1.35, marginTop: 3 };

const v = (x: any) => (x !== undefined && x !== null && String(x).trim() !== "" ? String(x) : "—");

function R({ l, val }: { l: string; val?: any }) {
  return (
    <View style={st.row}>
      <Text style={st.lbl}>{l}</Text>
      <Text style={st.val}>{v(val)}</Text>
    </View>
  );
}
function Footer({ firma }: { firma: string }) {
  return (
    <Text style={st.footer} fixed>
      {firma} · Teknik Dosya · Gensis Teknik Dosya platformu ile üretilmiştir
    </Text>
  );
}
function DocHead({ firma, title }: { firma: any; title: string }) {
  return (
    <>
      <Text style={st.firmaName}>{v(firma.unvan || firma.kisa_ad)}</Text>
      <Text style={st.firmaSub}>{[firma.adres, firma.sehir].filter(Boolean).join(" · ") || " "}</Text>
      <Text style={st.docTitle}>{title}</Text>
      <View style={st.rule} />
    </>
  );
}

// ---- Tarih yardımcıları (tüm belgelerde GG/AA/YYYY) ----
const pad2 = (n: number) => String(n).padStart(2, "0");
function parseDate(x: any): Date | null {
  if (!x && x !== 0) return null;
  if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
  const s = String(x).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
// GG/AA/YYYY; tarih değilse orijinali (ya da boş) döndür
function fmtTR(x: any): string {
  const d = parseDate(x);
  return d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : (x ? String(x) : "");
}
// PK tarihi − 2 gün; hafta sonuna denk gelirse bir önceki Cuma'ya
function minus2Friday(x: any): Date | null {
  const d = parseDate(x);
  if (!d) return null;
  const r = new Date(d);
  r.setDate(r.getDate() - 2);
  const wd = r.getDay(); // 0 Paz, 6 Cmt
  if (wd === 6) r.setDate(r.getDate() - 1);
  else if (wd === 0) r.setDate(r.getDate() - 2);
  return r;
}
function addYears(d: Date | null, y: number): Date | null {
  if (!d) return null;
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + y);
  return r;
}

type Ctx = ReturnType<typeof buildCtx>;
function buildCtx(data: any) {
  const d = data || {};
  const firma = d.firma || {};
  const modul = d.firma_modul || {};
  const muh = d.muhendis || {};
  const kap = d.kapasite || {};
  const inp = d.input_data || d;
  const ekipman: Record<string, any> = d.ekipman || {};
  const bugun = fmtTR(new Date());
  const tarih = d.dosya_tarihi ? fmtTR(d.dosya_tarihi) : bugun;
  const fname = v(firma.unvan || firma.kisa_ad);
  const kisi = d.kisi_sayisi ?? kap.kisi;
  const adaParsel = [inp.ada, inp.parsel].filter(Boolean).join(" / ");
  const eqEntries = Object.entries(ekipman);
  // asansör tipine göre belge dallanması
  const isHid = inp.asansor_tipi === "hidrolik";
  const aski = String(inp.aski_tipi || "").trim();
  const tahrikTuru = isHid ? "HİDROLİK ENDİREKT TAHRİK" : "ELEKTRİKLİ DİREKT TAHRİK";
  const projeTuru = isHid ? "HİDROLİK ASANSÖR" : "ELEKTRİKLİ ASANSÖR";
  const asansorTuru = isHid ? "Hidrolik Yük Asansörü" : "Elektrikli İnsan Asansörü";
  const garantiSinif = isHid ? "SINIF IV" : "SINIF I";
  // Periyodik kontrol tarihinden türeyen tarihler
  const pkTarihi = fmtTR(inp.periyodik_tarihi);           // periyodik kontrol tarihi
  const servisD = minus2Friday(inp.periyodik_tarihi);     // düzenleme / servise verildiği = PK − 2 gün (hafta sonu → Cuma)
  const servisTarihi = servisD ? fmtTR(servisD) : "";
  const garantiBitis = servisD ? fmtTR(addYears(servisD, 3)) : "";
  // Malın cinsi: tahrik türü (ELEKTRİKLİ/HİDROLİK) + askıya göre DİREKT/ENDİREKT
  const malinCinsi = (isHid ? "HİDROLİK" : "ELEKTRİKLİ") + " " + (aski.startsWith("1/1") ? "DİREKT TAHRİK" : "ENDİREKT TAHRİK");
  const faturaNo = v(inp.fatura_no);
  const faturaTarihi = fmtTR(inp.fatura_tarihi);
  return { d, firma, modul, muh, kap, inp, ekipman, bugun, tarih, fname, kisi, adaParsel, eqEntries, isHid, aski, tahrikTuru, projeTuru, asansorTuru, garantiSinif, pkTarihi, servisTarihi, garantiBitis, malinCinsi, faturaNo, faturaTarihi };
}

// CE işareti (vektör) — kapak için
function CeMark({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.58} viewBox="0 0 120 70">
      <Path d="M46.9,13.7 A26,26 0 1 0 46.9,56.3" stroke="#111827" strokeWidth={10} fill="none" strokeLinecap="butt" />
      <Path d="M98.9,13.7 A26,26 0 1 0 98.9,56.3" stroke="#111827" strokeWidth={10} fill="none" strokeLinecap="butt" />
      <Path d="M58,35 L94,35" stroke="#111827" strokeWidth={10} fill="none" strokeLinecap="butt" />
    </Svg>
  );
}

// Her belge için render fonksiyonu (code -> Page)
const RENDERERS: Record<string, (c: Ctx) => React.ReactElement> = {
  kapak: (c) => (
    <Page key="kapak" size="A4" style={st.page}>
      <View style={st.coverWrap}>
        <View style={{ alignItems: "center", marginBottom: 22 }}>
          <CeMark size={150} />
        </View>
        <Text style={st.coverBig}>ASANSÖR TEKNİK DOSYASI</Text>
        <Text style={st.coverSub}>2014/33 AB ASANSÖR YÖNETMELİĞİ</Text>
        <R l="Dosya No" val={c.d.dosya_no} />
        <View style={{ height: 10 }} />
        <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
        <R l="Bina Adı" val={c.d.bina_adi} />
        <R l="Bina Adresi" val={c.d.montaj_adresi} />
        <R l="Pafta / Ada / Parsel" val={[c.inp.pafta, c.inp.ada, c.inp.parsel].filter(Boolean).join(" / ")} />
        <View style={{ height: 20 }} />
        <Text style={{ fontSize: 9, color: "#6b7280" }}>{c.tarih}</Text>
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),

  dilekce: (c) => (
    <Page key="dilekce" size="A4" style={st.page}>
      <View style={st.topRow}><Text> </Text><Text>{c.tarih}</Text></View>
      <Text style={{ textAlign: "center", fontWeight: "bold", color: NAVY, fontSize: 12, marginBottom: 4 }}>
        {v(c.d.belediye).toUpperCase()} BELEDİYE BAŞKANLIĞI'NA
      </Text>
      <Text style={{ textAlign: "center", color: "#6b7280", marginBottom: 18 }}>{v(c.d.il)}</Text>
      <Text style={st.p}>
        Aşağıda özellikleri verilmiş olan ve firmamız tarafından montajı yapılan 1 adet asansör için
        tescil belgesinin tarafımıza verilmesini arz ederiz.
      </Text>
      <R l="Yapı Sahibi" val={c.inp.yapi_sahibi} />
      <R l="Montaj Adresi" val={c.d.montaj_adresi} />
      <R l="Pafta" val={c.inp.pafta} />
      <R l="Ada" val={c.inp.ada} />
      <R l="Parsel" val={c.inp.parsel} />
      <R l="Beyan Yükü" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} Kg. · ${v(c.kisi)} Kişi` : undefined} />
      <R l="Beyan Hızı" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : undefined} />
      <R l="Durak Sayısı" val={c.d.durak_adedi} />
      <Text style={{ marginTop: 20 }}>Saygılarımızla,</Text>
      <View style={st.signWrap}>
        <View />
        <View style={st.signBox}>
          <Text style={{ fontWeight: "bold" }}>{c.fname}</Text>
          <Text style={st.signLine}>Kaşe / İmza</Text>
        </View>
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),

  firma_bilgileri: (c) => (
    <Page key="firma_bilgileri" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="FİRMA BİLGİLERİ" />
      <R l="Ticari Ünvan" val={c.firma.unvan} />
      <R l="Tescilli Marka" val={c.firma.tescilli_marka} />
      <R l="Yetkili / Ünvanı" val={c.firma.yetkili} />
      <R l="Adres" val={c.firma.adres} />
      <R l="Yer" val={c.firma.sehir} />
      <R l="Ülke" val="TÜRKİYE" />
      <R l="Telefon" val={c.firma.telefon} />
      <R l="Faks" val={c.firma.faks} />
      <R l="Sanayi Sicil No" val={c.firma.sanayi_sicil_no} />
      <R l="CE İşaretlemesi Sorumlusu" val={c.muh.makine?.ad || c.firma.yetkili} />
      <Footer firma={c.fname} />
    </Page>
  ),

  tescil: (c) => {
    const eq = c.ekipman;
    const guv: [string, any][] = [
      ["Durak kapılarını kilitleme tertibatı", eq.kapi_kilidi || {}],
      ["Kabinin düşmesini veya kontrolsüz hareket etmesini engelleyen tertibatlar", eq.fren_blogu || {}],
      ["Aşırı hız sınırlayıcı tertibatlar", eq.hiz_regulatoru || {}],
      ["Kabin Tamponu", eq.tampon_kabin || eq.tampon || {}],
      ["Ağırlık Tamponu", eq.tampon_agirlik || {}],
      ["Elektronik aksamları içeren güvenlik şalterleri şeklindeki elektrikli güvenlik tertibatları", eq.kumanda || {}],
    ];
    return (
      <Page key="tescil" size="A4" style={st.pageForm}>
        <Text style={st.formTitle}>EK-1: YENİ ASANSÖR İÇİN TESCİL BELGESİ</Text>
        <View style={st.fBox}>
          <FRow l="TESCİL TARİHİ" val="" />
          <FRow l="TESCİL KAYIT NUMARASI" val="" />
          <FRow l="TESCİLİ YAPAN İLGİLİ İDARENİN ADI VE ADRESİ" val={c.d.belediye ? `${v(c.d.belediye)} Belediyesi` : ""} />
          <FSection>ASANSÖR MONTE EDENE DAİR BİLGİLER</FSection>
          <FRow l="ASANSÖR MONTE EDENİN ADI" val={c.firma.unvan} />
          <FRow l="ASANSÖR MONTE EDENİN ADRESİ" val={c.firma.adres} />
          <FRow l="ASANSÖR MONTE EDENE AİT İLETİŞİM BİLGİLERİ" val={c.firma.telefon} />
          <FSection>ASANSÖRE DAİR BİLGİLER</FSection>
          <FRow l="ASANSÖR KİMLİK NUMARASI" val={c.inp.asansor_kimlik_no} />
          <FRow l="ADA VE PARSEL NO" val={c.adaParsel} />
          <FRow l="ASANSÖRÜN MONTAJ ADRESİ" val={c.d.montaj_adresi} />
          <FRow l="ASANSÖRÜN MARKASI" val={c.firma.tescilli_marka} />
          <FRow l="ASANSÖRÜN SERİ NUMARASI" val={c.inp.asansor_seri_no} />
          <FRow l="ASANSÖRÜN İMAL YILI" val={c.d.imal_yili} />
          <FRow l="ASANSÖRÜN TAHRİK TÜRÜ" val={c.malinCinsi} />
          <FRow l="ASANSÖRÜN HIZI" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : ""} />
          <FRow l="ASANSÖRÜN KAPASİTESİ VEYA BEYAN YÜKÜ" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} kg` : ""} />
          <FRow l="ASANSÖRÜN DURAK SAYISI" val={c.d.durak_adedi} />
          <FSection>ASANSÖR GÜVENLİK AKSAMLARI</FSection>
          <View style={st.fColHead}>
            <Text style={st.fc1}>Aksam</Text>
            <Text style={st.fc2}>MARKA</Text>
            <Text style={st.fc3}>MODEL</Text>
            <Text style={st.fc4}>SERİ NO</Text>
          </View>
          {guv.map(([lab, e], i) => (
            <View style={st.fRow} key={i}>
              <Text style={st.fc1}>{lab}</Text>
              <Text style={st.fc2}>{e?.marka || ""}</Text>
              <Text style={st.fc3}>{e?.model || ""}</Text>
              <Text style={st.fc4}>{e?.seri_no || ""}</Text>
            </View>
          ))}
          <FSection>MEVZUAT</FSection>
          <FRow l="YÖNETMELİK ADI" val="ASANSÖR YÖNETMELİĞİ (2014/33/AB)" />
          <FSection>AT UYGUNLUK BEYANINA DAİR BİLGİLER</FSection>
          <FRow l="BEYAN TARİHİ" val={c.servisTarihi} />
          <FRow l="İMZA SAHİBİNİN ADI VE SOYADI" val={c.firma.yetkili} />
          <FSection>UYGUNLUK BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="BELGE NUMARASI" val={c.inp.modul_belge_no || c.modul.belge_no} />
          <FRow l="BELGE DÜZENLENME TARİHİ" val={fmtTR(c.inp.modul_belge_tarihi) || c.modul.tarih} />
          <FRow l="ONAYLANMIŞ KURULUŞUN ADI" val={c.inp.modul_onaylanmis_kurulus || c.modul.onaylanmis_kurulus} />
          <FRow l="ONAYLANMIŞ KURULUŞUN KİMLİK NUMARASI" val={c.inp.modul_kurulus_no || c.modul.kurulus_no} />
          <FSection>SANAYİ SİCİL BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="BELGE TARİHİ" val={fmtTR(c.inp.sanayi_sicil_tarihi)} />
          <FRow l="BELGE NUMARASI" val={c.inp.sanayi_sicil_no} />
          <FSection>TSE HİZMET YETERLİLİK BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="BELGENİN DÜZENLENDİĞİ TARİH" val={fmtTR(c.inp.tse_tarihi)} />
          <FRow l="BELGENİN GEÇERLİLİK SÜRESİ" val={fmtTR(c.inp.tse_gecerlilik)} />
          <FSection>GARANTİ BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="DÜZENLENDİĞİ TARİH" val={c.servisTarihi} />
          <FRow l="GARANTİ SÜRESİ" val="3 YIL" />
        </View>
        <Text style={{ fontSize: 7.3, marginTop: 6, textAlign: "justify" }}>
          {v(c.d.montaj_adresi)} adresinde monte edilen ve {c.servisTarihi} Tarihinde piyasaya arz edilmiş olan asansörün tescili, 06.04.2019 tarihli ve 30737 sayılı Resmî Gazete’de yayımlanan Asansör İşletme ve Bakım Yönetmeliğine göre yapılmıştır.
        </Text>
        <View style={{ marginTop: 14, alignSelf: "flex-end", borderWidth: 1, borderColor: "#9aa4b2", width: 240 }}>
          <Text style={{ fontSize: 7.3, textAlign: "center", padding: 4, borderBottomWidth: 1, borderColor: "#9aa4b2", fontWeight: "bold" }}>İLGİLİ İDARE ADINA İMZA YETKİLİSİNİN</Text>
          <Text style={{ fontSize: 7.3, textAlign: "center", paddingTop: 4, height: 46 }}>İMZA VE MÜHÜR</Text>
        </View>
      </Page>
    );
  },

  garanti: (c) => (
    <Page key="garanti" size="A4" style={st.page}>
      <Text style={st.formTitle}>GARANTİ BELGESİ</Text>
      <Text style={st.formSub}>EK-3</Text>
      <View style={st.fBox}>
        <FRow l="BELGE DÜZENLEME TARİHİ" val={c.servisTarihi} />
        <FRow l="BELGE EN SON GEÇERLİLİK TARİHİ" val={c.garantiBitis} />
        <FSection>ASANSÖR MONTE EDENİN / İMALATÇININ / İTHALATÇININ / DAĞITICININ</FSection>
        <FRow l="ÜNVANI" val={c.firma.unvan} />
        <FRow l="ADRESİ" val={c.firma.adres} />
        <FRow l="TELEFON VE FAKS NUMARASI, DİĞER İLETİŞİM BİLGİLERİ" val={c.firma.telefon} />
        <FSection>FATURANIN</FSection>
        <FRow l="TARİHİ" val={c.faturaTarihi} />
        <FRow l="SAYISI" val={c.faturaNo} />
        <FSection>MALIN</FSection>
        <FRow l="CİNSİ" val={c.malinCinsi} />
        <FRow l="MARKASI" val={c.firma.tescilli_marka} />
        <FRow l="MODELİ" val={c.garantiSinif} />
        <FRow l="SERİ NUMARASI" val={c.inp.asansor_seri_no} />
        <FRow l="TESLİM TARİHİ" val={c.tarih} />
        <FRow l="TESLİM ADRESİ" val={c.d.montaj_adresi} />
        <FRow l="ADA VE PARSEL NO" val={c.adaParsel} />
        <FRow l="AZAMİ TAMİR SÜRESİ" val="15 GÜN" />
        <FRow l="GARANTİ SÜRESİ" val="3 YIL" />
        <FSection>YETKİLİ SERVİSİN VEYA SERVİSLERİN</FSection>
        <FRow l="ÜNVANI" val={c.firma.unvan} />
        <FRow l="ADRESİ" val={c.firma.adres} />
        <FRow l="TELEFON VE FAKS NUMARASI, DİĞER İLETİŞİM BİLGİLERİ" val={c.firma.telefon} />
        <FSection>ONAY</FSection>
        <FRow l="FİRMA YETKİLİSİNİN ADI VE SOYADI" val={c.firma.yetkili} />
        <FRow l="FİRMA YETKİLİSİNİN İMZASI" val="" />
        <FRow l="FİRMA KAŞESİ" val="" />
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),

  bakim_sozlesmesi: (c) => (
    <Page key="bakim_sozlesmesi" size="A4" style={st.page} wrap>
      <Text style={[st.formTitle, { marginBottom: 4 }]}>ASANSÖR BAKIM SÖZLEŞMESİ</Text>

      <BsMadde no={1} baslik="AKİTLER">
        <View style={{ flexDirection: "row", marginTop: 3 }}>
          <View style={{ flex: 1, borderWidth: 0.6, borderColor: "#94a3b8", padding: 5, marginRight: 8 }}>
            <Text style={{ fontWeight: "bold", fontSize: 8.6 }}>Bakım Yapan (1)</Text>
            <Text style={{ fontSize: 8.4, marginTop: 2 }}>Ünvanı : {v(c.firma.unvan)}</Text>
            <Text style={{ fontSize: 8.4 }}>Adresi : {v(c.firma.adres)}</Text>
            <Text style={{ fontSize: 7.6, color: "#64748b", marginTop: 3 }}>1) İşbu sözleşmede (YÜKLENİCİ) kelimesi ile ifade edilmiştir.</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 0.6, borderColor: "#94a3b8", padding: 5 }}>
            <Text style={{ fontWeight: "bold", fontSize: 8.6 }}>Müşteri (2)</Text>
            <Text style={{ fontSize: 8.4, marginTop: 2 }}>Ünvanı : {v(c.inp.yapi_sahibi)}</Text>
            <Text style={{ fontSize: 8.4 }}>Adresi : {v(c.inp.yapi_sahibi_adresi)}</Text>
            <Text style={{ fontSize: 7.6, color: "#64748b", marginTop: 3 }}>2) İş bu sözleşmede (MÜŞTERİ) kelimesi ile ifade edilmiştir.</Text>
          </View>
        </View>
      </BsMadde>

      <BsMadde no={2} baslik="SÖZLEŞMENİN KONUSU VE KAPSAMI">
        {`Sözleşme, ${v(c.d.montaj_adresi)} adresi/adreslerinde bulunan ve özellikleri Madde 11'de belirtilen asansörü/asansörleri kapsar, sözleşmenin konusu asansör aylık periyodik bakım hizmetinin sağlanmasıdır.`}
      </BsMadde>

      <BsMadde no={3} baslik="BAKIMIN TARİFİ">
        Bakım; bilimum makine, cihaz ve akşamların her bakımdan normal olarak çalışan bir asansör tesisinin teknik özelliklerine uygun olarak çalışır vaziyette bulundurulmasını temin için yüklenicinin yetkili bakım personeli tarafından yapılan temizlik, yağlama, ayar, muayene ve deneylerin tamamıdır. Bakımlar TS 12255 ve TS EN 13015+A1 standardına uygun yapılır. Yürürlükte olan Bilim Sanayi ve Teknoloji Bakanlığı tarafından yayınlanan Asansör İşletme ve Bakım Yönetmeliği hükümlerine tabiidir.
      </BsMadde>

      <View style={{ marginTop: 6 }}>
        <Text style={{ fontWeight: "bold", color: "#1e2a5b", fontSize: 9 }}>BAKIMI GERÇEKLEŞTİRECEK OLAN PERSONELİN BİLGİLERİ</Text>
        <View style={{ flexDirection: "row", marginTop: 3 }}>
          {[0, 1].map((k) => (
            <View key={k} style={{ flex: 1, borderWidth: 0.6, borderColor: "#94a3b8", padding: 4, marginRight: k === 0 ? 8 : 0 }}>
              <Text style={{ fontSize: 8.4 }}>Ad, Soyad : </Text>
              <Text style={{ fontSize: 8.4, marginTop: 2 }}>İletişim No : </Text>
              <Text style={{ fontSize: 8.4, marginTop: 2 }}>MYK Belge No : </Text>
            </View>
          ))}
        </View>
      </View>

      <BsMadde no={4} baslik="BAKIM MALZEMESİ">
        Yağ, üstüpü vb. gibi bakım ile ilgili sarf malzemeleri müşteri tarafından temin edilecektir.
      </BsMadde>

      <BsMadde no={5} baslik="BAKIM VE KONTROLÜN İFA ŞEKLİ">
        <View>
          <Text style={bsP}>Asansör(Asansörler), ayda bir defa kontrol edilerek bakımı yapılacaktır. Ani olarak vuku bulan arızalar müşteri tarafından mesai saatleri içinde bildirildiği saatten itibaren en geç 4(dört) saat içinde ilgili bakım ekibi bakım mahallîne ulaşacaktır.</Text>
          <Text style={bsP}>Yüklenici tarafından Müşterinin belirleyeceği en az 2(iki) kişiye acil durumlarda kurtarma konusunda eğitim verilecektir ve bu durum tutanakla kayıt altına alınacaktır.</Text>
          <Text style={bsP}>Mesai saatleri dışında arızaya müdahale hususunda ücret talep edilmesi veya bedelsiz olarak müdahale edilmesi hususu iş bu sözleşmenin 16. Maddesinde belirlenecek özel şartlar dahilinde değerlendirilecektir.</Text>
          <Text style={bsP}>Asansörde anormal bir durum tespit edildiğinde, bakım ekibi gelinceye kadar asansör servis dışı bırakılacaktır.</Text>
        </View>
      </BsMadde>

      <BsMadde no={6} baslik="BAKIM VE KONTROLE YETKİLİ OLANLAR">
        Yüklenicinin görevlendirdiği elemandan başka hiçbir yabancı asansör makine dairesine giremez (Asansörde mahsur kalma durumunda yükleniciden eğitim almış müşteri temsilcisi hariç.), tesisatlara el süremez.
      </BsMadde>

      <BsMadde no={7} baslik="YAPILACAK TAMİRAT TADİLAT VE DEĞİŞİKLİK İŞLERİ">
        <View>
          <Text style={bsP}>Asansörün bakımı ile ilgili olmayan, tabii aşınma, yıpranma, kırılma, malzeme konstrüksiyon hatası, harici tesirler, yabancıların müdahalesi ve benzeri sebeplerden doğan tamirat ve bazı akşamların değiştirilmesi kayıtsız şartsız müşteri hesabına yapılır.</Text>
          <Text style={bsP}>Tamirat veya bazı parçaların değişmesi gerekliliği müşteriye bildirilecek müşterinin onayı ile yapılacaktır. Onayın gerçekleştirilmesine kadar olan sürede ve yüklenicinin gerekli malzemeyi temini için gerekli ola makul bir sürede asansörün işlememesinden yüklenici sorumlu tutulmayacaktır. Ayrıca ilgili yönetmeliklerde ancak Asansör Monte eden tanımına giren yükleniciler tarafından yapılabileceği tarif edilen değişiklikleri ancak monte eden tanımına uyan yükleniciler yapabilirler.</Text>
        </View>
      </BsMadde>

      <BsMadde no={8} baslik="TEKNİK VE İDARİ TALİMAT VE KURALLARA RİAYETSİZLİK">
        Asansör tesislerinde teknik ve idari kurallara aykırı emniyet tertibatı ve yetersiz emniyet tedbirleri tespitinde keyfiyet müşteriye bildirilir. Eğer müşteri bildirilen noksanlıkların ve aykırılıkların düzeltilmesi için gerekli tedbir ve malzemelerin yüklenici tarafından müşteri nam ve hesabına karşılanmasına olur vermez ve zaaf gösterirse vuku bulan veya bulması olası kaza ve kazalarda kendisi sorumlu olacaktır. Yüklenici tarafından yazılı olarak müşteriye bildirilen veya teklif edilen tadilat, tamirat, değişiklik ve ilave işleri ile emniyet tertibatlarıyla ilgili işlerin müşteri tarafından yaptırılmaması veya yükleniciye yapması için gerekli onayı vermemesi durumunda yüklenici taahhüdünden vazgeçebilir sözleşmeyi tek taraflı olarak fesih edebilir. Bu hususta yüklenici sorumlu tutulamaz. Aynı şekilde firmanın sözleşme şartlarına uymamasının tespiti durumunda da müşteri hiçbir ihtara gerek olmadan tek taraflı olarak sözleşmeyi fesih edebilir.
      </BsMadde>

      <BsMadde no={9} baslik="SÖZLEŞME MÜDDETİ VE FESİH">
        İşbu sözleşme imzalandığı tarihten itibaren 1(bir) yıl için geçerlidir. Taraflardan herhangi biri haklı sebep göstermek kaydı ile sözleşmeyi tek taraflı olarak fesih edebilir. Sözleşmenin haksız olarak feshi halinde, haksız feshi yapan taraf diğer taraftan sözleşmeden doğan zararı karşılamakla yükümlüdür.
      </BsMadde>

      <BsMadde no={10} baslik="ANLAŞMAZLIKLARIN ÇÖZÜMÜ">
        {`İş bu sözleşmeden doğan anlaşmazlıkların vukuunda ${v(c.firma.sehir) || "……………………"} Mahkemeleri ve İcra daireleri yetkilidir.`}
      </BsMadde>

      <BsMadde no={11} baslik="ASANSÖRÜN(ASANSÖRLERİN) ÖZELLİKLERİ">
        <View style={[st.tbl, { marginTop: 3 }]}>
          <View style={st.trow}>
            <Text style={[st.thcell, { width: "20%" }]}>ASANSÖR SERİ NUMARASI</Text>
            <Text style={[st.thcell, { width: "13%" }]}>BEYAN YÜKÜ</Text>
            <Text style={[st.thcell, { width: "13%" }]}>BEYAN HIZI</Text>
            <Text style={[st.thcell, { width: "11%" }]}>DURAK ADEDİ</Text>
            <Text style={[st.thcell, { width: "24%" }]}>ASANSÖRÜN TİPİ</Text>
            <Text style={[st.thcell, { width: "19%" }]}>ASANSÖR KİMLİK NUMARASI</Text>
          </View>
          <View style={st.trow}>
            <Text style={[st.tcell, { width: "20%" }]}>{v(c.inp.asansor_seri_no)}</Text>
            <Text style={[st.tcell, { width: "13%" }]}>{c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} kg` : ""}</Text>
            <Text style={[st.tcell, { width: "13%" }]}>{c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : ""}</Text>
            <Text style={[st.tcell, { width: "11%" }]}>{v(c.d.durak_adedi)}</Text>
            <Text style={[st.tcell, { width: "24%" }]}>{c.malinCinsi}</Text>
            <Text style={[st.tcell, { width: "19%" }]}>{v(c.inp.asansor_kimlik_no)}</Text>
          </View>
        </View>
      </BsMadde>

      <BsMadde no={12} baslik="ASANSÖRÜN(ASANSÖRLERİN) BAKIM ÜCRETİ">
        <View>
          <Text style={bsP}>Asansörün / Asansörlerin aylık bakım ücreti toplam .................... - TL  (Yalnız: ............................................... Türk Lirası \ ........................................................ Kuruş)’tur. Fiyatlara %20 KDV dahildir. / değildir.</Text>
          <Text style={bsP}>Bakım ücreti ve müşterinin onayı ile yüklenici tarafından yapılan tamiratların ve değişen malzemelerin bedeli müşteri tarafından fatura karşılığı nakden veya yüklenicinin bildireceği Banka hesap numarasına hesaben ödenecektir.</Text>
        </View>
      </BsMadde>

      <BsMadde no={13} baslik="VERGİ, RESİM VE HARÇLAR">
        İşbu sözleşmeden olan sözleşme damga vergisini taraflar kendi yükümlülükleri oranında ödeyecektir. Sözleşme kapsamındaki tüm vergi, resim ve harçlar ile İş ve Sosyal Güvenlik Kanunları karşısındaki yükümlülük Yükleniciye aittir.
      </BsMadde>

      <BsMadde no={14} baslik="PERİYODİK MUAYENE">
        Mevcut Asansör İşletme ve Bakım Yönetmeliği kapsamında ilgili yerel yönetim kuruluşu adına A Tipi muayene kuruluşlarına yaptırılması zorunlu olan Asansör Yıllık Periyodik muayeneleri ile ilgili ücretler müşteri tarafından ödenir, ödemeye ilişkin makbuz veya faturanın ibrazıyla müşteriden tahsil edilir.
      </BsMadde>

      <BsMadde no={15} baslik="GARANTİ">
        Takılan malzemeler ve yapılan işçilik 2(iki) yıl Şirket Garantisi altındadır. Garanti, Şirket ve Müşteri arasındaki bakım sözleşmesinin garanti süresince kesintisiz olarak devam etmesi şartına bağlıdır.
      </BsMadde>

      <BsMadde no={16} baslik="ÖZEL ŞARTLAR">
        <View>
          <Text style={bsP}>VARSA AŞAĞIDA ASANSÖR ÜZERİNDEKİ KUMANDA VEYA CİHAZLARDA ŞİFRELEME YAPILDI İSE ŞİFRE VEYA KODLARI BELİRTİNİZ</Text>
          <View style={{ borderWidth: 0.6, borderColor: "#94a3b8", height: 40, marginTop: 4 }} />
        </View>
      </BsMadde>

      <BsMadde no={17} baslik="YÜRÜRLÜLÜK">
        <View>
          <Text style={bsP}>Bu madde dahil 17 maddeden itibaren ibaret olan İşbu sözleşme taraflarca okunmuş ve 2(iki) nüsha ve 2(iki) sayfa olarak   ……. / ……. / …….   tarihinde tanzim ve imza edilmiştir.</Text>
          <Text style={bsP}>İşbu sözleşme   ……. / ……. / …….   tarihinde yürürlüğe girer.</Text>
        </View>
      </BsMadde>

      <View style={{ flexDirection: "row", marginTop: 24 }}>
        <View style={{ flex: 1, alignItems: "center" }}><Text style={{ fontSize: 9, fontWeight: "bold" }}>YÜKLENİCİ (İsim, Kaşe, İmza)</Text></View>
        <View style={{ flex: 1, alignItems: "center" }}><Text style={{ fontSize: 9, fontWeight: "bold" }}>MÜŞTERİ (İsim, Kaşe, İmza)</Text></View>
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),

  muh_taahhut_makine: (c) => taahhutPage(c, "makine"),
  muh_taahhut_elektrik: (c) => taahhutPage(c, "elektrik"),

  uygunluk_beyani: (c) => (
    <Page key="uygunluk_beyani" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="UYGUNLUK BEYANI" />
      <Text style={st.p}>
        Aşağıda teknik bilgileri verilen asansörün; 2014/33/AB Asansör Yönetmeliği ve ilgili
        uyumlaştırılmış standartlar (TS EN 81-20 / TS EN 81-50) hükümlerine uygun olarak tasarlandığını,
        imal ve monte edildiğini beyan ederiz.
      </Text>
      <Text style={st.sec}>Asansör Bilgileri</Text>
      <R l="Bina / İl" val={[c.d.bina_adi, c.d.il].filter(Boolean).join(" · ")} />
      <R l="Beyan Yükü" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} kg` : undefined} />
      <R l="Kişi Sayısı" val={c.kisi} />
      <R l="Beyan Hızı" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : undefined} />
      <R l="Kat / Durak" val={`${v(c.d.kat_adedi)} / ${v(c.d.durak_adedi)}`} />
      <Text style={st.sec}>Belgelendirme</Text>
      <R l="Uygunluk Modülü" val={c.d.modul} />
      <R l="Onaylanmış Kuruluş" val={c.modul.onaylanmis_kurulus} />
      <R l="Modül Belge No" val={c.modul.belge_no} />
      <Footer firma={c.fname} />
    </Page>
  ),

  yazili_beyanname: (c) => (
    <Page key="yazili_beyanname" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="BEYANNAME" />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Asansörün Tipi" val={c.tahrikTuru} />
      <R l="Yapım Yılı" val={c.d.imal_yili} />
      <R l="Seyir Mesafesi" val={c.inp.seyir_mesafesi ? `${c.inp.seyir_mesafesi} m` : undefined} />
      <R l="Beyan Yükü" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} Kg` : undefined} />
      <R l="Beyan Hızı" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : undefined} />
      <R l="Kat / Durak Adedi" val={`${v(c.d.kat_adedi)} / ${v(c.d.durak_adedi)}`} />
      <R l="Ada / Parsel" val={c.adaParsel} />
      <R l="Asansör Adresi" val={c.d.montaj_adresi} />
      <R l="Firma Adı / Ünvanı" val={c.firma.unvan} />
      <R l="Firma Adresi" val={c.firma.adres} />
      <R l="Firma Yetkilisi" val={c.firma.yetkili} />
      <Text style={{ marginTop: 12, fontSize: 9, color: "#6b7280" }}>
        İş bu evrak; 03.04.2021 tarihli, 31443 sayılı Resmî Gazete kapsamında düzenlenmiştir.
      </Text>
      <View style={st.signWrap}>
        <View />
        <View style={st.signBox}>
          <Text style={{ fontWeight: "bold" }}>{v(c.firma.yetkili)}</Text>
          <Text style={st.signLine}>Kaşe / İmza</Text>
        </View>
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),

  teknik_komponent: (c) => teknikKomponentPage(c),

  motor_beyannamesi: (c) => (
    <Page key="motor_beyannamesi" size="A4" style={st.page}>
      <View style={st.topRow}><Text> </Text><Text>Tarih: {c.tarih}</Text></View>
      <Text style={{ textAlign: "center", fontWeight: "bold", color: NAVY, fontSize: 12, marginBottom: 2 }}>MOTOR BEYANNAMESİ</Text>
      <Text style={{ textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
        {v(c.d.belediye).toUpperCase()} BELEDİYE BAŞKANLIĞI RUHSAT VE DENETİM MÜDÜRLÜĞÜ
      </Text>
      <Text style={st.p}>
        {v(c.d.montaj_adresi)} adresinde, {v(c.inp.pafta)} pafta {v(c.inp.ada)} ada {v(c.inp.parsel)} parsel
        sayılı yerde bulunan {c.isHid ? "hidrolik ünitesinin" : "elektrik motorunun"} fenni ve teknik şartlara uygun olarak kullanılacağını beyan ederiz.
      </Text>
      <Text style={st.sec}>{c.isHid ? "Ünite / Piston Özellikleri" : "Motorun Özellikleri"}</Text>
      {c.isHid ? (
        <>
          <R l="Ünite / Motor Bilgisi" val={c.inp.unite_bilgisi} />
          <R l="Piston Ölçüleri" val={c.inp.piston_olculeri ? `${c.inp.piston_olculeri} mm` : undefined} />
          <R l="Piston Yeri" val={c.inp.piston_yeri} />
          <R l="Debi" val={c.inp.debi ? `${c.inp.debi} l/d` : undefined} />
        </>
      ) : (
        <>
          <R l="Motor Markası" val={c.ekipman.motor?.marka} />
          <R l="Motor Modeli" val={c.ekipman.motor?.model} />
          <R l="Motor Seri No" val={c.ekipman.motor?.seri_no || c.inp.motor_seri_no} />
          <R l="Motor Gücü" val={c.inp.motor_gucu ? `${c.inp.motor_gucu} kW` : undefined} />
        </>
      )}
      <Text style={{ marginTop: 16, textAlign: "right" }}>SAYGILARIMIZLA</Text>
      <Footer firma={c.fname} />
    </Page>
  ),

  seyir_defteri: (c) => {
    const tall = { minHeight: 34 } as const;
    return (
    <Page key="seyir_defteri" size="A4" style={st.page} wrap>
      <Text style={st.formTitle}>ASANSÖR SEYİR DEFTERİ</Text>
      <View style={{ height: 6 }} />
      <View style={st.fBox}>
        <FRow l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
        <FRow l="Asansör Sahibinin Adresi" val={c.inp.yapi_sahibi_adresi} />
        <FRow l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
        <FRow l="Asansör Seri No" val={c.inp.asansor_seri_no} />
        <FRow l="Asansör Kimlik No" val={c.inp.asansor_kimlik_no} />
        <FRow l="Yapımcı Firma" val={c.firma.unvan} />
        <FRow l="Yapımcı Firma Adresi" val={c.firma.adres} />
        <FRow l="Asansörün Servise Verildiği Tarih" val={c.servisTarihi} />
        <FRow l="Bakım Sözleşmesi Tarihi" val="" />
      </View>

      <Text style={[st.sec, { marginTop: 10 }]}>ASANSÖR TEKNİK ÖZELLİKLERİ</Text>
      <View style={st.fBox}>
        <FRow l="Askı Tipi" val={c.inp.aski_tipi} />
        <FRow l="Seyir Mesafesi" val={c.inp.seyir_mesafesi ? `${c.inp.seyir_mesafesi} m` : ""} />
        <FRow l="Beyan Yükü" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} kg · ${v(c.kisi)} kişi` : ""} />
        <FRow l="Beyan Hızı" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : ""} />
        <FRow l="Kat / Durak Adedi" val={`${v(c.d.kat_adedi)} / ${v(c.d.durak_adedi)}`} />
        <FRow l="Kapı Tipi ve Ebatı" val={[c.inp.kat_kapisi, ebat(c.inp.kapi_genislik, c.inp.kapi_yukseklik)].filter(Boolean).join(" · ")} />
        <FRow l="Kabin Ebatları ve Ağırlığı" val={[ebat(c.inp.kabin_genislik, c.inp.kabin_derinlik), (c.inp.kabin_agirligi || c.kap?.kabin_agirlik) ? `${c.inp.kabin_agirligi || c.kap?.kabin_agirlik} kg` : ""].filter(Boolean).join(" · ")} />
        {!c.isHid && <FRow l="Karşı Ağırlık Yeri ve Ağırlığı" val={[c.inp.karsi_agirlik_yeri, (c.inp.karsi_agirlik_agirligi || c.kap?.karsi_agirlik) ? `${c.inp.karsi_agirlik_agirligi || c.kap?.karsi_agirlik} kg` : ""].filter(Boolean).join(" · ")} />}
      </View>

      <Text style={[st.sec, { marginTop: 12 }]}>ÖNEMLİ REVİZYON VE DEĞİŞİKLİKLER</Text>
      <View style={[st.tbl, { flexGrow: 1 }]}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "6%" }]}>No</Text>
          <Text style={[st.thcell, { width: "48%" }]}>Yapılan Revizyon veya Değişiklik</Text>
          <Text style={[st.thcell, { width: "16%" }]}>Yapımcı</Text>
          <Text style={[st.thcell, { width: "18%" }]}>Adres ve Telefonu</Text>
          <Text style={[st.thcell, { width: "12%" }]}>Tarih</Text>
        </View>
        {[...Array(8)].map((_, i) => (
          <View style={[st.trow, { flexGrow: 1 }]} key={i}>
            <Text style={[st.tcellTall, tall, { width: "6%", textAlign: "center" }]}>{i + 1}</Text>
            <Text style={[st.tcellTall, tall, { width: "48%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "16%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "18%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "12%" }]}> </Text>
          </View>
        ))}
      </View>

      <Text style={[st.sec, { marginTop: 12 }]} break>YASAL VE PERİYODİK KONTROLLER</Text>
      <View style={[st.tbl, { flexGrow: 1 }]}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "6%" }]}>No</Text>
          <Text style={[st.thcell, { width: "30%" }]}>Kontrolü Yapan Kuruluş</Text>
          <Text style={[st.thcell, { width: "33%" }]}>Kontrolü Gerçekleştiren{"\n"}Adı-Soyadı / Unvanı</Text>
          <Text style={[st.thcell, { width: "16%" }]}>Kaşe / İmza</Text>
          <Text style={[st.thcell, { width: "15%" }]}>Tarih</Text>
        </View>
        {[...Array(7)].map((_, i) => (
          <View style={[st.trow, { flexGrow: 1 }]} key={i}>
            <Text style={[st.tcellTall, tall, { width: "6%", textAlign: "center" }]}>{i + 1}</Text>
            <Text style={[st.tcellTall, tall, { width: "30%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "33%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "16%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "15%" }]}> </Text>
          </View>
        ))}
      </View>

      <Text style={[st.sec, { marginTop: 12 }]}>BİLDİRİLMESİ GEREKEN ÖNEMLİ OLAYLAR (KURTARMA OPERASYONLARI, KAZALAR vb.)</Text>
      <View style={[st.tbl, { flexGrow: 1 }]}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "6%" }]}>No</Text>
          <Text style={[st.thcell, { width: "50%" }]}>Olay Açıklaması</Text>
          <Text style={[st.thcell, { width: "22%" }]}>Kaydı Yapan</Text>
          <Text style={[st.thcell, { width: "12%" }]}>Tarih</Text>
          <Text style={[st.thcell, { width: "10%" }]}>İmza</Text>
        </View>
        {[...Array(7)].map((_, i) => (
          <View style={[st.trow, { flexGrow: 1 }]} key={i}>
            <Text style={[st.tcellTall, tall, { width: "6%", textAlign: "center" }]}>{i + 1}</Text>
            <Text style={[st.tcellTall, tall, { width: "50%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "22%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "12%" }]}> </Text>
            <Text style={[st.tcellTall, tall, { width: "10%" }]}> </Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 7.4, marginTop: 12, color: "#475569", textAlign: "justify" }}>
        NOT: Asansörün güvenliğini etkileyecek revizyon gerçekleştiren her asansör firması ile kontrolü
        gerçekleştiren her kuruluş, yaptığı işlemi bu deftere kaydetmekle yükümlüdür.
      </Text>
      <Footer firma={c.fname} />
    </Page>
    );
  },

  egitim_tutanagi: (c) => (
    <Page key="egitim_tutanagi" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="ASANSÖRDE MAHSUR KALAN KİŞİLERİN KURTARILMASI EĞİTİMİ" />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
      <R l="Servise Veriliş Tarihi" val={c.servisTarihi} />
      <R l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
      <R l="Asansör Sahibinin Adresi" val={c.inp.yapi_sahibi_adresi} />
      <Text style={st.sec}>EĞİTİM İÇERİĞİ</Text>
      <Text style={st.p}>
        Aşağıda listede ismi bulunan kişilere, yetkili kişi tarafından, asansörde mahsur kalan
        kişilerin kurtarılmasına yönelik eğitim verilmiştir.
      </Text>
      <R l="Eğitim Verilen Yer" val="" />
      <Text style={[st.sec, { marginTop: 10 }]}>EĞİTİMİ ALANLAR</Text>
      <View style={st.tbl}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "6%" }]}>No</Text>
          <Text style={[st.thcell, { width: "60%" }]}>İsim Soyisim</Text>
          <Text style={[st.thcell, { width: "34%" }]}>İmza</Text>
        </View>
        {[...Array(6)].map((_, i) => (
          <View style={st.trow} key={i}>
            <Text style={[st.tcellTall, { minHeight: 26, width: "6%", textAlign: "center" }]}>{i + 1}</Text>
            <Text style={[st.tcellTall, { minHeight: 26, width: "60%" }]}> </Text>
            <Text style={[st.tcellTall, { minHeight: 26, width: "34%" }]}> </Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 16, width: "55%" }}>
        <View style={st.fBox}>
          <FRow l="Eğitimi Veren — İsim Soyisim" val="" />
          <FRow l="İmza" val="" />
        </View>
      </View>
      <Text style={{ marginTop: 14, color: "#6b7280" }}>Tarih : ...../...../.........</Text>
      <Footer firma={c.fname} />
    </Page>
  ),

  teslim_tutanagi: (c) => (
    <Page key="teslim_tutanagi" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="ASANSÖR ve DOKÜMAN TESLİM TUTANAĞI" />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
      <R l="Servise Veriliş Tarihi" val={c.servisTarihi} />
      <R l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
      <R l="Asansör Sahibinin Adresi" val={c.inp.yapi_sahibi_adresi} />
      <Text style={st.sec}>ASANSÖR SAHİBİNE VERİLEN DOKÜMAN LİSTESİ</Text>
      {[
        "AB Uygunluk Beyanı", "Asansör Teknik Özellikleri", "Güvenlik Ekipmanları Listesi",
        "Asansör Projesi", "Güvenlik Ekipmanları CE ve Test Belgeleri",
        "Güvenlik Ekipmanları Kullanma Kılavuzları, Şema ve Diyagramları",
        "Asansör Kullanma Kılavuzu", "Asansör Kurtarma Talimatı", "Asansör Seyir Defteri",
        "Diğer (Belirtiniz)",
      ].map((t, i) => (
        <View style={[st.listRow, { alignItems: "center" }]} key={i}>
          <Text style={st.listNo}>{i + 1}.</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
          <View style={st.ckbox} />
        </View>
      ))}
      <Text style={st.p}>
        Yukarıda belirtilen dokümanları eksiksiz ve asansörü / asansörleri çalışır vaziyette teslim aldım.
      </Text>
      <View style={[st.tbl, { marginTop: 10 }]}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "16%" }]}>Tarih</Text>
          <Text style={[st.thcell, { width: "16%" }]}>Yer</Text>
          <Text style={[st.thcell, { width: "34%" }]}>Asansör Sahibi{"\n"}Ad – Soyad / Kaşe / İmza</Text>
          <Text style={[st.thcell, { width: "34%" }]}>Montaj Firması{"\n"}Ad – Soyad / Kaşe / İmza</Text>
        </View>
        <View style={st.trow}>
          <Text style={[st.tcellTall, { minHeight: 54, width: "16%" }]}> </Text>
          <Text style={[st.tcellTall, { minHeight: 54, width: "16%" }]}> </Text>
          <Text style={[st.tcellTall, { minHeight: 54, width: "34%" }]}> </Text>
          <Text style={[st.tcellTall, { minHeight: 54, width: "34%" }]}> </Text>
        </View>
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),

  kullanim_klavuzu: (c) => (
    <Page key="kullanim_klavuzu" size="A4" style={st.page} wrap>
      <DocHead firma={c.firma} title="ASANSÖR KULLANIM KILAVUZU" />
      {(c.isHid ? KULLANIM_KLAVUZU_HID : KULLANIM_KLAVUZU).map((t, i) => (
        <View key={i} style={st.klvItem} wrap={false}>
          <Text style={st.klvNo}>{i + 1}.</Text>
          <Text style={st.klvText}>{t}</Text>
        </View>
      ))}
      <Footer firma={c.fname} />
    </Page>
  ),

  bakim_klavuzu: (c) => (
    <Page key="bakim_klavuzu" size="A4" style={st.page} wrap>
      <DocHead firma={c.firma} title="ASANSÖR BAKIM KILAVUZU" />
      {(c.isHid ? BAKIM_KLAVUZU_HID : BAKIM_KLAVUZU).map((t, i) => (
        <View key={i} style={st.klvItem} wrap={false}>
          <Text style={st.klvNo}>{i + 1}.</Text>
          <Text style={st.klvText}>{t}</Text>
        </View>
      ))}
      <Footer firma={c.fname} />
    </Page>
  ),

  son_kontrol_formu: (c) => (
    <Page key="son_kontrol_formu" size="A4" style={st.page} wrap>
      <DocHead firma={c.firma} title="ASANSÖR SON KONTROL FORMU (EN 81-20 / 28 / 70 / 73)" />
      <View style={[st.fBox, { marginBottom: 8 }]}>
        <FRow l="Montaj Adresi" val={c.d.montaj_adresi} />
        <FRow l="Ada / Pafta / Parsel" val={[c.inp.ada, c.inp.pafta, c.inp.parsel].filter(Boolean).join(" / ")} />
        <FRow l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      </View>
      <View style={st.skHead} fixed>
        <Text style={st.skNo}>#</Text>
        <Text style={st.skItem}>Kontrol Maddesi</Text>
        <Text style={st.skBox}>Uygun</Text>
        <Text style={st.skBox}>Uygun D.</Text>
      </View>
      {SON_KONTROL.map((t, i) => (
        <View key={i} style={st.skRow} wrap={false}>
          <Text style={st.skNo}>{i + 1}</Text>
          <Text style={st.skItem}>{t}</Text>
          <View style={st.skBox}><View style={st.skSquare} /></View>
          <View style={st.skBox}><View style={st.skSquare} /></View>
        </View>
      ))}
      <View style={{ marginTop: 18, flexDirection: "row", justifyContent: "flex-end" }} wrap={false}>
        <View style={{ width: "55%" }}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: NAVY, marginBottom: 4 }}>Kontrol Sorumlusu</Text>
          <View style={st.fBox}>
            <FRow l="Adı-Soyadı" val="" />
            <FRow l="Tarih" val="" />
            <FRow l="İmza" val="" />
          </View>
        </View>
      </View>
      <Footer firma={c.fname} />
    </Page>
  ),
};

function EkBelgelerPage(c: Ctx) {
  return (
    <Page key="ek" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="EK BELGELER" />
      <Text style={st.p}>
        Aşağıdaki ek(ler) teknik dosyanın parçasıdır ve bir sonraki güncellemede otomatik eklenecektir:
      </Text>
      {["Seçili ekipmanların ürün sertifikaları (PDF ekleri)"].map(
        (t, i) => (
          <View style={st.listRow} key={i}>
            <Text style={st.listNo}>•</Text>
            <Text>{t}</Text>
          </View>
        )
      )}
      <Footer firma={c.fname} />
    </Page>
  );
}

// only: tek belge (string) | seçili belgeler (string[]) | tümü (undefined)
export function TeknikDosyaDoc({ data, only }: { data: any; only?: string | string[] }) {
  const c = buildCtx(data);
  const onlyList = only ? (Array.isArray(only) ? only : [only]) : null;
  const codes = TEKNIK_DOSYA_BELGELERI
    .filter((b) => b.hazir && (!onlyList || onlyList.includes(b.code)))
    .map((b) => b.code);
  const pages = codes.map((code) => RENDERERS[code]?.(c)).filter(Boolean) as React.ReactElement[];
  if (!onlyList) pages.push(EkBelgelerPage(c)); // ek belgeler notu yalnız "tümü"nde
  return <Document>{pages}</Document>;
}
