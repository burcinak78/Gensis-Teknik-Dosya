import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// Proje Onay Dosyası belgeleri: Dilekçe + Makine/Elektrik Mühendis Taahhütnamesi.
// Tek belge veya toplu (birleşik) PDF üretebilir. Font 'Roboto' route'ta register edilir.

const NAVY = "#1e2a5b";

const st = StyleSheet.create({
  // Dilekçe
  page: { fontFamily: "Roboto", fontSize: 11, color: "#111827", paddingTop: 48, paddingHorizontal: 56, paddingBottom: 56, lineHeight: 1.6 },
  firma: { fontSize: 15, fontWeight: "bold", color: NAVY },
  tarih: { textAlign: "right", marginTop: 6, marginBottom: 26 },
  belediye: { fontWeight: "bold", marginTop: 2, textAlign: "center" },
  il: { fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  arz: { textAlign: "justify", marginBottom: 22 },
  row: { flexDirection: "row", paddingVertical: 3 },
  label: { width: 130, color: "#374151" },
  sep: { width: 10 },
  value: { flex: 1, fontWeight: "bold" },
  saygi: { textAlign: "right", marginTop: 40 },
  imzaFirma: { textAlign: "right", fontWeight: "bold", color: NAVY, marginTop: 2 },
  imzaLine: { alignSelf: "flex-end", width: 200, borderTopWidth: 0.6, borderTopColor: "#9ca3af", marginTop: 46, paddingTop: 4, fontSize: 9, color: "#6b7280", textAlign: "center" },

  // Taahhütname (resmi kutulu form)
  // Taahhütname: Asansör Teknik Dosya (ATD) taahhutPage formatıyla aynı
  formPage: { fontFamily: "Roboto", fontSize: 10, color: "#1f2937", paddingTop: 42, paddingHorizontal: 42, paddingBottom: 60, lineHeight: 1.45 },
  formTitle: { textAlign: "center", fontWeight: "bold", fontSize: 12, color: "#0f172a", marginBottom: 1 },
  formSub: { textAlign: "center", fontSize: 8.5, color: "#475569", marginBottom: 6 },
  fBox: { borderTopWidth: 0.8, borderLeftWidth: 0.8, borderRightWidth: 0.8, borderColor: "#334155" },
  fRow: { flexDirection: "row", borderBottomWidth: 0.8, borderColor: "#334155" },
  fLabel: { width: "46%", paddingVertical: 1.8, paddingHorizontal: 4, fontSize: 7.3, fontWeight: "bold", color: "#1f2937", borderRightWidth: 0.8, borderColor: "#334155" },
  fVal: { flex: 1, paddingVertical: 1.8, paddingHorizontal: 4, fontSize: 7.3, color: "#111827" },
  fSection: { paddingVertical: 2, paddingHorizontal: 4, fontSize: 7.6, fontWeight: "bold", color: "#0f172a", backgroundColor: "#e5e9f0", textAlign: "center", borderBottomWidth: 0.8, borderColor: "#334155" },
  // Taahhütname: bölüm grubu — satır arası çizgi yok, yalnız dış sınır + bölüm başlığı çizgileri
  tBox: { borderWidth: 0.8, borderColor: "#334155" },
  tRow: { flexDirection: "row" },
  // Sabit etiket sütunu (en uzun etiket "Pafta / Ada / Parsel No"ya göre) — dikey çizgi yok,
  // değerler tek sütunda hizalı ve mümkün olduğunca sola yanaşık
  tLabel: { width: 108, paddingVertical: 1.8, paddingHorizontal: 4, fontSize: 7.3, fontWeight: "bold", color: "#1f2937" },
  tVal: { flex: 1, paddingVertical: 1.8, paddingLeft: 2, paddingRight: 4, fontSize: 7.3, color: "#111827" },
  tSection: { paddingVertical: 2, paddingHorizontal: 4, fontSize: 7.6, fontWeight: "bold", color: "#0f172a", backgroundColor: "#e5e9f0", textAlign: "center", borderTopWidth: 0.8, borderBottomWidth: 0.8, borderColor: "#334155" },
  tOuter: { borderWidth: 0.8, borderColor: "#334155", padding: 10, marginTop: 12 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#9ca3af", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
});

const v = (x: any) => (x !== undefined && x !== null && String(x).trim() !== "" ? String(x) : "");

function FRow({ l, val }: { l: string; val?: any }) {
  return (
    <View style={st.fRow}>
      <Text style={st.fLabel}>{l}</Text>
      <Text style={st.fVal}>{v(val)}</Text>
    </View>
  );
}
function FSection({ children }: { children: any }) {
  return <Text style={st.fSection}>{children}</Text>;
}
// Taahhütname bölüm satırı (satır arası çizgisiz) ve bölüm başlığı
function TRow({ l, val }: { l: string; val?: any }) {
  return (
    <View style={st.tRow}>
      <Text style={st.tLabel}>{l}</Text>
      <Text style={st.tVal}>{v(val)}</Text>
    </View>
  );
}
function TSection({ children }: { children: any }) {
  return <Text style={st.tSection}>{children}</Text>;
}
// Footer: Ticari Ünvan · Adres · Telefon · E-posta — tek satır, sığacak şekilde punto küçülür
const fitFsPO = (s: any, base = 8, min = 5) => {
  const txt = String(s || "");
  const contentW = 490;
  const est = txt.length * base * 0.5;
  return est <= contentW ? base : Math.max(min, (base * contentW) / est);
};
function FooterBar({ d }: { d: any }) {
  const f = d.firma || {};
  const text = [f.unvan || f.kisa_ad || d.firma_adi, f.adres, f.telefon, f.email]
    .filter(Boolean).map((x: any) => String(x).trim()).join(" · ");
  return <Text style={[st.footer, { fontSize: fitFsPO(text) }]} fixed numberOfLines={1}>{text || " "}</Text>;
}
function SigRow({ l, val }: { l: string; val?: any }) {
  const t = val != null && String(val).trim() !== "" ? String(val) : "";
  return (
    <View style={{ flexDirection: "row", marginBottom: 6 }}>
      <Text style={{ width: 84, fontSize: 9, fontWeight: "bold" }}>{l}</Text>
      <Text style={{ fontSize: 9 }}>: {t}</Text>
    </View>
  );
}

function DilekcePage({ d }: { d: any }) {
  const firmaAdi = v(d.firma_adi) || v(d.firma?.unvan) || "—";
  // Başlık: seçilmiş İlgili İdare + BAŞKANLIĞI'NA (BELEDİYESİ eklenmez)
  const idare = (v(d.ilgili_idare) || v(d.belediye) || "…………").toLocaleUpperCase("tr");
  const il = (v(d.il) || "…………").toLocaleUpperCase("tr");
  const tarih = "…..../…..…/20…"; // otomatik gelmez
  const adet = v(d.adet) || "1";
  const kapasite = [d.beyan_yuku_kg ? `${d.beyan_yuku_kg} Kg.` : "", d.kisi_sayisi ? `${d.kisi_sayisi} Kişi` : ""].filter(Boolean).join(" , ");
  return (
    <Page key="dilekce" size="A4" style={st.page}>
      {/* Sol üst firma adı yerinde kalır */}
      <Text style={st.firma}>{firmaAdi}</Text>
      {/* Tarihten itibaren içerik sayfa yüksekliğine göre ortalanır */}
      <View style={{ flexGrow: 1, justifyContent: "center" }}>
        <Text style={st.tarih}>{tarih}</Text>
        <Text style={st.belediye}>{idare} BAŞKANLIĞI'NA,</Text>
        <Text style={st.il}>{il}</Text>
        <Text style={st.arz}>
          Aşağıda özellikleri verilmiş olan {adet} adet asansör için proje onayının tarafımıza verilmesini arz ederiz.
        </Text>
        <Prow l="Yapı Sahibi" val={d.yapi_sahibi} />
        <Prow l="Montaj Adresi" val={d.montaj_adresi} />
        <Prow l="Pafta" val={d.pafta} />
        <Prow l="Ada" val={d.ada} />
        <Prow l="Parsel" val={d.parsel} />
        <Prow l="Beyan Yükü" val={kapasite} />
        <Prow l="Beyan Hızı" val={d.beyan_hizi ? `${d.beyan_hizi} m/s` : ""} />
        <Prow l="Durak Sayısı" val={d.durak_sayisi} />
        <Text style={st.saygi}>Saygılarımızla,</Text>
        <Text style={st.imzaFirma}>{firmaAdi}</Text>
        <Text style={st.imzaLine}>Kaşe / İmza</Text>
      </View>
      <FooterBar d={d} />
    </Page>
  );
}
function Prow({ l, val }: { l: string; val?: any }) {
  return (
    <View style={st.row}>
      <Text style={st.label}>{l}</Text>
      <Text style={st.sep}>:</Text>
      <Text style={st.value}>{v(val)}</Text>
    </View>
  );
}

function TaahhutPage({ d, disc }: { d: any; disc: "makine" | "elektrik" }) {
  const m = disc === "makine" ? d.muh?.makine : d.muh?.elektrik;
  const unvan = disc === "makine" ? "MAKİNA MÜHENDİSİ" : "ELEKTRİK MÜHENDİSİ";
  const unvanTam = disc === "makine" ? "Makine Mühendisi" : "Elektrik Mühendisi";
  const fname = v(d.firma?.unvan || d.firma?.kisa_ad || d.firma_adi);
  // Projenin Türü: tahrik türü biliniyorsa önek + asansör adedi
  const adet = Number(d.adet) || 1;
  const tipOnek = d.asansor_tipi === "hidrolik" ? "HİDROLİK ASANSÖR" : d.asansor_tipi === "elektrik" ? "ELEKTRİKLİ ASANSÖR" : "ASANSÖR";
  const projeTuru = `${tipOnek} / ${adet} ADET`;
  return (
    <Page key={"muh_taahhut_" + disc} size="A4" style={st.formPage}>
      <Text style={st.formTitle}>TAAHHÜTNAME</Text>
      <View style={st.tBox}>
        <TSection>PROJE MÜELLİFİ</TSection>
        <TRow l="Oda Sicil No" val={m?.oda_sicil} />
        <TRow l="Unvanı" val={unvan} />
        <TRow l="Adresi" val={m?.adres} />
        <TRow l="Telefonu" val={m?.telefon} />
        <TSection>MÜELLİFLİĞİ ÜSTLENİLEN PROJE</TSection>
        <TRow l="İl / İlçe" val={[d.il, d.belediye].filter(Boolean).join(" / ")} />
        <TRow l="İlgili İdare" val={v(d.ilgili_idare) || (d.belediye ? `${v(d.belediye)} Belediyesi` : "")} />
        <TRow l="Pafta / Ada / Parsel No" val={[d.pafta, d.ada, d.parsel].filter(Boolean).join(" / ")} />
        <TRow l="Yapı Adresi" val={d.montaj_adresi} />
        <TRow l="Yapı Sahibi" val={d.yapi_sahibi} />
        <TRow l="Yapı Sahibinin Adresi" val={d.yapi_sahibi_adresi} />
        <TRow l="Projenin Türü" val={projeTuru} />
      </View>
      <View style={st.tOuter}>
        <Text style={{ fontSize: 8.6, textAlign: "justify", lineHeight: 1.5 }}>
          Yukarıdaki bilgilere sahip projenin müellifliğini üstlenmemde 6235 sayılı Türk Mühendis ve Mimar Odaları Birliği Kanunu, 3194 sayılı İmar Kanunu ve ilgili mevzuat kapsamında süreli veya süresiz olarak mesleki faaliyet haklarımda herhangi bir kısıtlılık bulunmadığını, Yukarıdaki bilgilere sahp yapıya ilişkin hazırlanacak tüm projelerde, 3194 sayılı Kanun ve deprem, yangın,enerji verimliliği,asansör gibi ilgili tüm mevzuat hükümlerini eksiksiz uygulayacağımı taahhüt ederim.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22 }}>
          <Text style={{ fontSize: 9 }}>Tarih : …./…./20…</Text>
          <View style={{ alignItems: "flex-end", position: "relative", height: 70 }}>
            {m?.imza && (
              <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, left: 0, alignItems: "flex-end", justifyContent: "center" }}>
                <Image src={m.imza} style={{ width: 130, height: 44, objectFit: "contain" }} />
              </View>
            )}
            <Text style={{ fontSize: 9.5, fontWeight: "bold", marginBottom: 8 }}>Proje Müellifi</Text>
            <Text style={{ fontSize: 9, marginBottom: 7 }}>Ad Soyad</Text>
            <Text style={{ fontSize: 9, marginBottom: 7 }}>İsim Ünvanı</Text>
            <Text style={{ fontSize: 9 }}>İmza</Text>
          </View>
        </View>
        <Text style={{ fontSize: 7.6, marginTop: 16, textAlign: "justify", color: "#475569", lineHeight: 1.45 }}>
          Gerçeğe aykırı beyanda bulunduğu tespit edilenlerin işlemleri iptal edilecek ve bu kişiler hakkında 5237 sayılı Türk Ceza Kanununun ilgili hükümleri gereği Cumhuriyet Savcılığına suç duyurusunda bulunulacak, ayrıca 6235 sayılı Türk Mühendis ve Mimar Odaları Birliği Kanunu ve ilgili mevzuatı uyarınca işlem yapılmak üzere ilgili Meslek Odasına bilgi verilecektir.
        </Text>
      </View>
      <FooterBar d={d} />
    </Page>
  );
}

export const PROJE_ONAY_BELGELERI: { code: string; ad: string }[] = [
  { code: "dilekce", ad: "Avan Proje Onay Dilekçesi" },
  { code: "makine_taahhut", ad: "Makine Mühendisi Taahhütnamesi" },
  { code: "elektrik_taahhut", ad: "Elektrik Mühendisi Taahhütnamesi" },
];

export function ProjeOnayDoc({ data, docs }: { data: any; docs?: string[] }) {
  const which = docs && docs.length ? docs : PROJE_ONAY_BELGELERI.map((b) => b.code);
  const pages: React.ReactElement[] = [];
  for (const code of which) {
    if (code === "dilekce") pages.push(<DilekcePage key="dilekce" d={data} />);
    else if (code === "makine_taahhut") pages.push(<TaahhutPage key="mt" d={data} disc="makine" />);
    else if (code === "elektrik_taahhut") pages.push(<TaahhutPage key="et" d={data} disc="elektrik" />);
  }
  return <Document>{pages}</Document>;
}
