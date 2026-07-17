import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Proje Onay Dosyası belgeleri: Dilekçe + Makine/Elektrik Mühendis Taahhütnamesi.
// Tek belge veya toplu (birleşik) PDF üretebilir. Font 'Roboto' route'ta register edilir.

const NAVY = "#1e2a5b";

const st = StyleSheet.create({
  // Dilekçe
  page: { fontFamily: "Roboto", fontSize: 11, color: "#111827", paddingTop: 48, paddingHorizontal: 56, paddingBottom: 56, lineHeight: 1.6 },
  firma: { fontSize: 15, fontWeight: "bold", color: NAVY },
  tarih: { textAlign: "right", marginTop: 6, marginBottom: 26 },
  belediye: { fontWeight: "bold", marginTop: 2 },
  il: { fontWeight: "bold", marginBottom: 20 },
  arz: { textAlign: "justify", marginBottom: 22 },
  row: { flexDirection: "row", paddingVertical: 3 },
  label: { width: 130, color: "#374151" },
  sep: { width: 10 },
  value: { flex: 1, fontWeight: "bold" },
  saygi: { textAlign: "right", marginTop: 40 },
  imzaFirma: { textAlign: "right", fontWeight: "bold", color: NAVY, marginTop: 2 },
  imzaLine: { alignSelf: "flex-end", width: 200, borderTopWidth: 0.6, borderTopColor: "#9ca3af", marginTop: 46, paddingTop: 4, fontSize: 9, color: "#6b7280", textAlign: "center" },

  // Taahhütname (resmi kutulu form)
  formPage: { fontFamily: "Roboto", fontSize: 9, color: "#1f2937", paddingTop: 42, paddingHorizontal: 48, paddingBottom: 56, lineHeight: 1.45 },
  formTitle: { textAlign: "center", fontWeight: "bold", fontSize: 13, color: "#0f172a", marginBottom: 1 },
  formSub: { textAlign: "center", fontSize: 9, color: "#475569", marginBottom: 10 },
  fBox: { borderTopWidth: 0.8, borderLeftWidth: 0.8, borderRightWidth: 0.8, borderColor: "#334155" },
  fRow: { flexDirection: "row", borderBottomWidth: 0.8, borderColor: "#334155" },
  fLabel: { width: "42%", paddingVertical: 2.6, paddingHorizontal: 5, fontSize: 8.4, fontWeight: "bold", color: "#1f2937", borderRightWidth: 0.8, borderColor: "#334155" },
  fVal: { flex: 1, paddingVertical: 2.6, paddingHorizontal: 5, fontSize: 8.4, color: "#111827" },
  fSection: { paddingVertical: 2.6, paddingHorizontal: 5, fontSize: 8.6, fontWeight: "bold", color: "#0f172a", backgroundColor: "#e5e9f0", textAlign: "center", borderBottomWidth: 0.8, borderColor: "#334155" },
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

function DilekcePage({ d }: { d: any }) {
  const firmaAdi = v(d.firma_adi) || v(d.firma?.unvan) || "—";
  const belediye = (v(d.belediye) || "…………").toLocaleUpperCase("tr");
  const il = (v(d.il) || "…………").toLocaleUpperCase("tr");
  const tarih = v(d.tarih) || "…..../…..…/ " + new Date().getFullYear();
  const adet = v(d.adet) || "1";
  const kapasite = [d.beyan_yuku_kg ? `${d.beyan_yuku_kg} Kg.` : "", d.kisi_sayisi ? `${d.kisi_sayisi} Kişi` : ""].filter(Boolean).join(" , ");
  return (
    <Page key="dilekce" size="A4" style={st.page}>
      <Text style={st.firma}>{firmaAdi}</Text>
      <Text style={st.tarih}>{tarih}</Text>
      <Text style={st.belediye}>{belediye} BELEDİYE BAŞKANLIĞI'NA,</Text>
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
  const unvanKisa = disc === "makine" ? "Mak.Müh." : "Elk.Müh.";
  const fname = v(d.firma?.unvan || d.firma?.kisa_ad || d.firma_adi);
  return (
    <Page key={"muh_taahhut_" + disc} size="A4" style={st.formPage}>
      <Text style={st.formTitle}>TAAHHÜTNAME</Text>
      <Text style={st.formSub}>{unvan}</Text>
      <View style={st.fBox}>
        <FSection>PROJE MÜELLİFİ</FSection>
        <FRow l="Oda Sicil No" val={m?.oda_sicil} />
        <FRow l="Unvanı" val={unvan} />
        <FRow l="Adresi" val={m?.adres} />
        <FRow l="Telefonu" val={m?.telefon} />
        <FSection>MÜELLİFLİĞİ ÜSTLENİLEN PROJE</FSection>
        <FRow l="İl / İlçe" val={[d.il, d.belediye].filter(Boolean).join(" / ")} />
        <FRow l="İlgili İdare" val={d.belediye ? `${v(d.belediye)} Belediyesi` : ""} />
        <FRow l="Pafta / Ada / Parsel No" val={[d.pafta, d.ada, d.parsel].filter(Boolean).join(" / ")} />
        <FRow l="Yapı Adresi" val={d.montaj_adresi} />
        <FRow l="Yapı Sahibi" val={d.yapi_sahibi} />
        <FRow l="Yapı Sahibinin Adresi" val={d.yapi_sahibi_adresi} />
        <FRow l="Projenin Türü" val={d.projeTuru || "ASANSÖR"} />
      </View>
      <Text style={{ fontSize: 8.6, marginTop: 10, textAlign: "justify", lineHeight: 1.5 }}>
        Yukarıdaki bilgilere sahip projenin müellifliğini üstlendiğimi; 6235 sayılı Türk Mühendis ve
        Mimar Odaları Birliği Kanunu, 3194 sayılı İmar Kanunu ve ilgili mevzuat kapsamında söz konusu
        işi yapmaya yasal olarak yetkili olduğumu ve müellifliğim önünde herhangi bir kısıtlılık
        bulunmadığını; yukarıdaki bilgilere sahip yapıya ilişkin hazırlanan projenin imar, yapı,
        deprem, yangın, enerji verimliliği, asansör gibi ilgili tüm mevzuat hükümlerine uygun olarak
        hazırlandığını taahhüt ederim.
      </Text>
      <View style={{ marginTop: 30, alignSelf: "flex-end", width: "60%" }}>
        <Text style={{ fontSize: 9.5, fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>Proje Müellifi</Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <View style={{ marginRight: 16, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 6 }}>{unvanKisa}</Text>
            <Text style={{ fontSize: 9, marginBottom: 6 }}>{v(m?.ad)}</Text>
            <Text style={{ fontSize: 9 }}>Oda Sicil No: {v(m?.oda_sicil)}</Text>
          </View>
          <View style={{ minWidth: 68 }}>
            <Text style={{ fontSize: 9, marginBottom: 6 }}>Adı-Soyadı</Text>
            <Text style={{ fontSize: 9, marginBottom: 6 }}>Ünvanı</Text>
            <Text style={{ fontSize: 9 }}>İmza</Text>
          </View>
        </View>
      </View>
      <Text style={{ fontSize: 7.6, marginTop: 16, textAlign: "justify", color: "#475569", lineHeight: 1.45 }}>
        Gerçeğe aykırı beyanda bulunduğu tespit edilenlerin işlemleri iptal edilir ve haklarında Türk
        Ceza Kanununun ilgili hükümleri gereği Cumhuriyet Savcılığına ve 6235 sayılı Türk Mühendis ve
        Mimar Odaları Birliği Kanunu ile ilgili mevzuat gereği bağlı bulundukları meslek odasına bilgi
        verilecektir.
      </Text>
      <Text style={st.footer} fixed>
        {fname} · Proje Onay Dosyası · Gensis platformu ile üretilmiştir
      </Text>
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
