import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Avan Proje Onay Dilekçesi — standalone form verisinden üretilir.
// Font ('Roboto') route tarafında register edilir.

const NAVY = "#1e2a5b";

const s = StyleSheet.create({
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
});

const v = (x: any) => (x !== undefined && x !== null && String(x).trim() !== "" ? String(x) : "");

function Row({ l, val }: { l: string; val?: any }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{l}</Text>
      <Text style={s.sep}>:</Text>
      <Text style={s.value}>{v(val)}</Text>
    </View>
  );
}

export function AvanProjeDilekceDoc({ data }: { data: any }) {
  const d = data || {};
  const firmaAdi = v(d.firma_adi) || v(d.firma_unvan) || "—";
  const belediye = (v(d.belediye) || "…………").toLocaleUpperCase("tr");
  const il = (v(d.il) || "…………").toLocaleUpperCase("tr");
  const tarih = v(d.tarih) || "…..../…..…/ " + new Date().getFullYear();
  const adet = v(d.adet) || "1";
  const kapasite =
    [d.beyan_yuku_kg ? `${d.beyan_yuku_kg} Kg.` : "", d.kisi_sayisi ? `${d.kisi_sayisi} Kişi` : ""]
      .filter(Boolean).join(" , ");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.firma}>{firmaAdi}</Text>
        <Text style={s.tarih}>{tarih}</Text>

        <Text style={s.belediye}>{belediye} BELEDİYE BAŞKANLIĞI'NA,</Text>
        <Text style={s.il}>{il}</Text>

        <Text style={s.arz}>
          Aşağıda özellikleri verilmiş olan {adet} adet asansör için proje onayının tarafımıza
          verilmesini arz ederiz.
        </Text>

        <Row l="Yapı Sahibi" val={d.yapi_sahibi} />
        <Row l="Montaj Adresi" val={d.montaj_adresi} />
        <Row l="Pafta" val={d.pafta} />
        <Row l="Ada" val={d.ada} />
        <Row l="Parsel" val={d.parsel} />
        <Row l="Beyan Yükü" val={kapasite} />
        <Row l="Beyan Hızı" val={d.beyan_hizi ? `${d.beyan_hizi} m/s` : ""} />
        <Row l="Durak Sayısı" val={d.durak_sayisi} />

        <Text style={s.saygi}>Saygılarımızla,</Text>
        <Text style={s.imzaFirma}>{firmaAdi}</Text>
        <Text style={s.imzaLine}>Kaşe / İmza</Text>
      </Page>
    </Document>
  );
}
