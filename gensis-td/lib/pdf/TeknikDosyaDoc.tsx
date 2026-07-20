import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
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
  coverBig: { fontSize: 30, fontWeight: "bold", color: NAVY, marginBottom: 8 },
  coverSub: { fontSize: 13, color: TEAL, marginBottom: 40 },
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
        <Text style={{ fontSize: 6.4 }}>{ad}</Text>
      </View>
      <View style={[st.kCol, { width: KW.kat }]}>
        {alt.map((k, i) => <Text key={i} style={[st.kSubC, i === son ? { borderBottomWidth: 0 } : {}]}>{k.ad}</Text>)}
      </View>
      <View style={[st.kCol, { width: KW.marka, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: 6.4 }}>{vb(e?.marka)}</Text>
      </View>
      <View style={[st.kCol, { width: KW.tip, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: 6.4 }}>{vb(e?.model)}</Text>
      </View>
      <View style={[st.kCol, { width: KW.seri }]}>
        {alt.map((k, i) => <Text key={i} style={[st.kSubC, i === son ? { borderBottomWidth: 0 } : {}]}>{k.seri}</Text>)}
      </View>
      <View style={[st.kCol, { width: KW.sert, justifyContent: "center", paddingHorizontal: 2 }]}>
        <Text style={{ fontSize: 6.4 }}>{vb(e?.sertifika_no)}</Text>
      </View>
      <View style={{ width: KW.kur, justifyContent: "center", paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 6.4 }}>{kurulus}</Text>
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
  const katlar = Array.from({ length: n }, (_, i) => ({ ad: `${i + 1}.KAT`, seri: katSeri[i] || "" }));
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
      <KInfo l="ASANSÖRÜN TİPİ" val={c.asansorTuru} />
      <KInfo l="YAPIM YILI" val={c.d.imal_yili} />
      <KInfo l="SEYİR MESAFESİ" val={c.inp.seyir_mesafesi} unit="m." />
      <KInfo l="BEYAN YÜKÜ" val={c.d.beyan_yuku_kg} unit="Kg." />
      <KInfo l="BEYAN HIZI" val={c.d.beyan_hizi} unit="m/s" />
      <KInfo l="KAT ADEDİ" val={c.d.kat_adedi} />
      <KInfo l="DURAK ADEDİ" val={c.d.durak_adedi} />

      <KSection>KAT KAPILARI</KSection>
      <KInfo sub l="Tipi" val={c.inp.kat_kapisi} />
      <KInfo sub l="Ebatlar" val={ebat(c.inp.kat_kapi_genislik, c.inp.kat_kapi_yukseklik)} unit="mm." />

      <KSection>KABİN</KSection>
      <KInfo sub l="Ebatları" val={ebat(c.inp.kabin_genislik, c.inp.kabin_derinlik)} unit="mm." />
      <KInfo sub l="Ağırlığı" val={c.kap?.kabin_agirlik} unit="Kg." />

      <KSection>KARŞI AĞIRLIK</KSection>
      <KInfo sub l="Yeri" val={c.inp.karsi_agirlik_yeri} />
      <KInfo sub l="Ağırlığı" val={c.kap?.karsi_agirlik} unit="Kg." />

      {c.isHid ? (
        <>
          <KSection>ÜNİTE / PİSTON</KSection>
          <KInfo sub l="Ünite / Motor" val={c.inp.unite_bilgisi} />
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
            <Text style={[st.kC, { width: "34%" }]}>{ad}</Text>
            <Text style={[st.kC, { width: KW.marka }]}>{vb(e?.marka)}</Text>
            <Text style={[st.kC, { width: KW.tip }]}>{vb(e?.model)}</Text>
            <Text style={[st.kC, { width: KW.seri }]}>{vb(e?.seri_no)}</Text>
            <Text style={[st.kC, { width: KW.sert }]}>{vb(e?.sertifika_no)}</Text>
            <Text style={[st.kC, { width: KW.kur }]}>{kurulus(e)}</Text>
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

const BAKIM_MADDELERI: [string, string][] = [
  ["MADDE 2 – Sözleşmenin Konusu ve Kapsamı",
    "Sözleşme, yukarıda adresi belirtilen asansörü/asansörleri kapsar. Konusu, asansörün aylık periyodik bakımının yapılmasıdır."],
  ["MADDE 3 – Bakımın Tarifi",
    "Bakım; makine, cihaz ve aksamların normal olarak çalışan bir asansör tesisinin teknik özelliklerine uygun çalışır durumda tutulmasıdır."],
  ["MADDE 4 – Bakım Malzemesi",
    "Yağ, üstüpü vb. bakım ile ilgili sarf malzemeleri müşteri tarafından temin edilecektir."],
  ["MADDE 5 – Bakım ve Kontrolün İfa Şekli",
    "Asansör ayda bir defa kontrol edilerek bakımı yapılacaktır. Yüklenici, müşterinin belirleyeceği en az 2 kişiye acil durumlarda kurtarma eğitimi verecektir. Anormal durum tespitinde asansör, bakım ekibi gelene kadar servis dışı bırakılacaktır."],
  ["MADDE 6 – Bakıma Yetkili Olanlar",
    "Yüklenicinin görevlendirdiği elemandan başka hiçbir yabancı asansör makine dairesine giremez."],
  ["MADDE 7 – Tamirat, Tadilat ve Değişiklik",
    "Tabii aşınma, harici tesir veya yabancı müdahalesi kaynaklı işler bakım kapsamı dışındadır. Parça değişimi müşteriye bildirilecek ve onayı ile yapılacaktır."],
  ["MADDE 9 – Sözleşme Müddeti ve Fesih",
    "İşbu sözleşme imzalandığı tarihten itibaren 1 (bir) yıl için geçerlidir. Taraflardan biri haklı sebeple sözleşmeyi feshedebilir."],
];

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

type Ctx = ReturnType<typeof buildCtx>;
function buildCtx(data: any) {
  const d = data || {};
  const firma = d.firma || {};
  const modul = d.firma_modul || {};
  const muh = d.muhendis || {};
  const kap = d.kapasite || {};
  const inp = d.input_data || d;
  const ekipman: Record<string, any> = d.ekipman || {};
  const bugun = new Date().toLocaleDateString("tr-TR");
  const tarih = d.dosya_tarihi || bugun;
  const fname = v(firma.unvan || firma.kisa_ad);
  const kisi = d.kisi_sayisi ?? kap.kisi;
  const adaParsel = [inp.ada, inp.parsel].filter(Boolean).join(" / ");
  const eqEntries = Object.entries(ekipman);
  // asansör tipine göre belge dallanması
  const isHid = inp.asansor_tipi === "hidrolik";
  const tahrikTuru = isHid ? "HİDROLİK ENDİREKT TAHRİK" : "ELEKTRİKLİ DİREKT TAHRİK";
  const projeTuru = isHid ? "HİDROLİK ASANSÖR" : "ELEKTRİKLİ ASANSÖR";
  const asansorTuru = isHid ? "Hidrolik Yük Asansörü" : "Elektrikli İnsan Asansörü";
  const garantiSinif = isHid ? "SINIF IV" : "SINIF I";
  return { d, firma, modul, muh, kap, inp, ekipman, bugun, tarih, fname, kisi, adaParsel, eqEntries, isHid, tahrikTuru, projeTuru, asansorTuru, garantiSinif };
}

// Her belge için render fonksiyonu (code -> Page)
const RENDERERS: Record<string, (c: Ctx) => React.ReactElement> = {
  kapak: (c) => (
    <Page key="kapak" size="A4" style={st.page}>
      <View style={st.coverWrap}>
        <Text style={st.coverBig}>TEKNİK DOSYA</Text>
        <Text style={st.coverSub}>2014/33 AB ASANSÖR YÖNETMELİĞİ</Text>
        <R l="Dosya No" val={c.d.dosya_no} />
        <View style={{ height: 10 }} />
        <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
        <R l="Bina Adı" val={c.d.bina_adi} />
        <R l="Bina Adresi" val={c.d.montaj_adresi} />
        <R l="Pafta / Ada / Parsel" val={[c.inp.pafta, c.inp.ada, c.inp.parsel].filter(Boolean).join(" / ")} />
        <View style={{ height: 24 }} />
        <Text style={st.firmaName}>{c.fname}</Text>
        <Text style={{ fontSize: 9, color: "#6b7280" }}>{c.tarih}</Text>
      </View>
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
      ["Kabinin düşmesini/kontrolsüz hareketini engelleyen tertibatlar", eq.fren_blogu || eq.kabin_kilidi || {}],
      ["Aşırı hız sınırlayıcı tertibatlar", eq.hiz_regulatoru || {}],
      ["Kabin Tamponu", eq.tampon_kabin || eq.tampon || {}],
      ["Ağırlık Tamponu", eq.tampon_agirlik || {}],
      ["Elektrikli güvenlik tertibatları", eq.kumanda || {}],
    ];
    return (
      <Page key="tescil" size="A4" style={st.pageForm}>
        <Text style={st.formTitle}>YENİ ASANSÖR İÇİN TESCİL BELGESİ</Text>
        <Text style={st.formSub}>EK-1</Text>
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
          <FRow l="ASANSÖRÜN TAHRİK TÜRÜ" val={c.tahrikTuru} />
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
          <FRow l="BEYAN TARİHİ" val={c.tarih} />
          <FRow l="İMZA SAHİBİNİN ADI VE SOYADI" val={c.firma.yetkili} />
          <FSection>UYGUNLUK BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="BELGE NUMARASI" val={c.modul.belge_no} />
          <FRow l="BELGE DÜZENLENME TARİHİ" val={c.modul.tarih} />
          <FRow l="ONAYLANMIŞ KURULUŞUN ADI" val={c.modul.onaylanmis_kurulus} />
          <FRow l="ONAYLANMIŞ KURULUŞUN KİMLİK NUMARASI" val={c.modul.kurulus_no} />
          <FSection>TSE HİZMET YETERLİLİK BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="BELGENİN GEÇERLİLİK SÜRESİ" val="1 YIL" />
          <FSection>GARANTİ BELGESİNE DAİR BİLGİLER</FSection>
          <FRow l="GARANTİ SÜRESİ" val="3 YIL" />
        </View>
        <Text style={{ fontSize: 7.3, marginTop: 6, textAlign: "justify" }}>
          {v(c.d.montaj_adresi)} adresinde monte edilen ve {c.tarih} tarihinde piyasaya arz edilmiş olan asansörün tescili yapılmıştır.
        </Text>
        <View style={{ marginTop: 14, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 7.3, textAlign: "center" }}>İLGİLİ İDARE ADINA İMZA YETKİLİSİNİN{"\n"}İMZA VE MÜHÜR</Text>
        </View>
      </Page>
    );
  },

  garanti: (c) => (
    <Page key="garanti" size="A4" style={st.page}>
      <Text style={st.formTitle}>GARANTİ BELGESİ</Text>
      <Text style={st.formSub}>EK-3</Text>
      <View style={st.fBox}>
        <FRow l="BELGE DÜZENLEME TARİHİ" val={c.tarih} />
        <FRow l="BELGE EN SON GEÇERLİLİK TARİHİ" val="" />
        <FSection>ASANSÖR MONTE EDENİN / İMALATÇININ / İTHALATÇININ / DAĞITICININ</FSection>
        <FRow l="ÜNVANI" val={c.firma.unvan} />
        <FRow l="ADRESİ" val={c.firma.adres} />
        <FRow l="TELEFON VE FAKS NUMARASI, DİĞER İLETİŞİM BİLGİLERİ" val={c.firma.telefon} />
        <FSection>FATURANIN</FSection>
        <FRow l="TARİHİ" val="" />
        <FRow l="SAYISI" val="" />
        <FSection>MALIN</FSection>
        <FRow l="CİNSİ" val={c.tahrikTuru} />
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
      <DocHead firma={c.firma} title="ASANSÖR BAKIM SÖZLEŞMESİ" />
      <R l="Yüklenici (Bakım Firması)" val={c.firma.unvan} />
      <R l="Müşteri (Yapı Sahibi)" val={c.inp.yapi_sahibi} />
      <R l="Asansör Adresi" val={c.d.montaj_adresi} />
      {BAKIM_MADDELERI.map(([b, m], i) => (
        <View key={i} style={{ marginTop: 8 }} wrap={false}>
          <Text style={{ fontWeight: "bold", color: NAVY, fontSize: 9.5 }}>{b}</Text>
          <Text style={{ textAlign: "justify", fontSize: 9.5 }}>{m}</Text>
        </View>
      ))}
      <Text style={st.sec}>MADDE 12 – Bakım Ücreti</Text>
      <R l="Aylık Bakım Ücreti" val={c.inp.bakim_ucreti} />
      <View style={st.signWrap}>
        <View style={st.signBox}><Text style={st.signLine}>Yüklenici</Text><Text style={{ fontSize: 9 }}>{c.fname}</Text></View>
        <View style={st.signBox}><Text style={st.signLine}>Müşteri</Text><Text style={{ fontSize: 9 }}>{v(c.inp.yapi_sahibi)}</Text></View>
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

  seyir_defteri: (c) => (
    <Page key="seyir_defteri" size="A4" style={st.page} wrap>
      <Text style={st.formTitle}>ASANSÖR SEYİR DEFTERİ</Text>
      <View style={{ height: 6 }} />
      <View style={st.fBox}>
        <FRow l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
        <FRow l="Asansör Sahibinin Adresi" val={c.inp.yapi_sahibi_adresi} />
        <FRow l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
        <FRow l="Asansör Seri No" val={c.inp.asansor_seri_no} />
        <FRow l="Yapımcı Firma" val={c.firma.unvan} />
        <FRow l="Yapımcı Firma Adresi" val={c.firma.adres} />
        <FRow l="Asansörün Servise Verildiği Tarih" val={c.tarih} />
        <FRow l="Bakım Sözleşmesi Tarihi" val="" />
      </View>

      <Text style={[st.sec, { marginTop: 14 }]}>ÖNEMLİ REVİZYON VE DEĞİŞİKLİKLER</Text>
      <View style={st.tbl}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "34%" }]}>Yapılan Revizyon veya Değişiklik</Text>
          <Text style={[st.thcell, { width: "22%" }]}>Yapımcı</Text>
          <Text style={[st.thcell, { width: "28%" }]}>Adres ve Telefonu</Text>
          <Text style={[st.thcell, { width: "16%" }]}>Tarih</Text>
        </View>
        {[...Array(7)].map((_, i) => (
          <View style={st.trow} key={i}>
            <Text style={[st.tcellTall, { width: "34%" }]}> </Text>
            <Text style={[st.tcellTall, { width: "22%" }]}> </Text>
            <Text style={[st.tcellTall, { width: "28%" }]}> </Text>
            <Text style={[st.tcellTall, { width: "16%" }]}> </Text>
          </View>
        ))}
      </View>

      <Text style={[st.sec, { marginTop: 14 }]} break>YASAL VE PERİYODİK KONTROLLER</Text>
      <View style={st.tbl}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "8%" }]}>No</Text>
          <Text style={[st.thcell, { width: "30%" }]}>Kontrolü Yapan Kuruluş</Text>
          <Text style={[st.thcell, { width: "31%" }]}>Kontrolü Gerçekleştiren{"\n"}Adı-Soyadı / Unvanı</Text>
          <Text style={[st.thcell, { width: "16%" }]}>Kaşe / İmza</Text>
          <Text style={[st.thcell, { width: "15%" }]}>Tarih</Text>
        </View>
        {[...Array(5)].map((_, i) => (
          <View style={st.trow} key={i}>
            <Text style={[st.tcellTall, { width: "8%", textAlign: "center" }]}>{i + 1}</Text>
            <Text style={[st.tcellTall, { width: "30%" }]}> </Text>
            <Text style={[st.tcellTall, { width: "31%" }]}> </Text>
            <Text style={[st.tcellTall, { width: "16%" }]}> </Text>
            <Text style={[st.tcellTall, { width: "15%" }]}> </Text>
          </View>
        ))}
      </View>

      <Text style={[st.sec, { marginTop: 14 }]}>BİLDİRİLMESİ GEREKEN ÖNEMLİ OLAYLAR (KURTARMA OPERASYONLARI, KAZALAR vb.)</Text>
      <View style={st.tbl}>
        <View style={st.trow}>
          <Text style={[st.thcell, { width: "8%" }]}>No</Text>
          <Text style={[st.thcell, { width: "92%" }]}>Olay Açıklaması / Tarih</Text>
        </View>
        {[...Array(5)].map((_, i) => (
          <View style={st.trow} key={i}>
            <Text style={[st.tcellTall, { width: "8%", textAlign: "center" }]}>{i + 1}</Text>
            <Text style={[st.tcellTall, { width: "92%" }]}> </Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 7.4, marginTop: 12, color: "#475569", textAlign: "justify" }}>
        NOT: Asansörün güvenliğini etkileyecek revizyon gerçekleştiren her asansör firması ile kontrolü
        gerçekleştiren her kuruluş, yaptığı işlemi bu deftere kaydetmekle yükümlüdür.
      </Text>
      <Footer firma={c.fname} />
    </Page>
  ),

  egitim_tutanagi: (c) => (
    <Page key="egitim_tutanagi" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="ASANSÖRDE MAHSUR KALAN KİŞİLERİN KURTARILMASI EĞİTİMİ" />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
      <R l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
      <Text style={st.p}>
        Aşağıda listede ismi bulunan kişilere, yetkili kişi tarafından asansörde mahsur kalan
        kişilerin kurtarılmasına yönelik eğitim verilmiştir.
      </Text>
      <View style={st.signWrap}>
        <View style={st.signBox}><Text style={st.signLine}>Eğitimi Veren (İsim / İmza)</Text></View>
        <View style={st.signBox}><Text style={st.signLine}>Eğitimi Alan (İsim / İmza)</Text></View>
      </View>
      <Text style={{ marginTop: 14, color: "#6b7280" }}>Tarih: {c.tarih}</Text>
      <Footer firma={c.fname} />
    </Page>
  ),

  teslim_tutanagi: (c) => (
    <Page key="teslim_tutanagi" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="ASANSÖR ve DOKÜMAN TESLİM TUTANAĞI" />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
      <R l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
      <Text style={st.sec}>Asansör Sahibine Verilen Doküman Listesi</Text>
      {[
        "AT Uygunluk Beyanı", "Asansör Teknik Özellikleri", "Güvenlik Ekipmanları Listesi",
        "Asansör Projesi", "Güvenlik Ekipmanları CE ve Test Belgeleri",
        "Güvenlik Ekipmanları Kullanma Kılavuzları, Şema ve Diyagramları",
        "Asansör Kullanma Kılavuzu", "Asansör Kurtarma Talimatı", "Asansör Seyir Defteri",
        "Diğer (Belirtiniz)",
      ].map((t, i) => (
        <View style={[st.listRow, { alignItems: "center" }]} key={i}>
          <View style={st.ckbox} />
          <Text style={st.listNo}>{i + 1}.</Text>
          <Text>{t}</Text>
        </View>
      ))}
      <Text style={st.p}>
        Yukarıda belirtilen dokümanları eksiksiz ve asansörü/asansörleri çalışır durumda teslim aldım.
      </Text>
      <Text style={{ marginTop: 8, color: "#6b7280" }}>Tarih: {c.tarih}</Text>
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
