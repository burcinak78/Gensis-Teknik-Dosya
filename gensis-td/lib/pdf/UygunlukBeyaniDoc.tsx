import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Uygunluk Beyanı PDF şablonu. Veri, project_render_context (jsonb) çıktısıdır.
// Font ('Roboto') route tarafında register edilir.

const NAVY = "#1e2a5b";
const TEAL = "#0d8b8b";

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 10, color: "#1f2937", padding: 40, lineHeight: 1.5 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, fontSize: 9, color: "#6b7280" },
  firma: { fontSize: 14, fontWeight: "bold", color: NAVY },
  firmaSub: { fontSize: 9, color: "#6b7280", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "bold", color: NAVY, textAlign: "center", marginTop: 8, marginBottom: 4 },
  titleRule: { borderBottomWidth: 2, borderBottomColor: TEAL, width: 120, alignSelf: "center", marginBottom: 16 },
  intro: { marginBottom: 16, textAlign: "justify" },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: TEAL, marginTop: 10, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3 },
  row: { flexDirection: "row", paddingVertical: 2 },
  label: { width: "40%", color: "#6b7280" },
  value: { width: "60%", fontWeight: "bold", color: "#111827" },
  eqRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9" },
  eqCat: { width: "26%", color: "#6b7280" },
  eqVal: { width: "42%", fontWeight: "bold" },
  eqCert: { width: "32%", fontSize: 9, color: "#374151" },
  signWrap: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  signBox: { width: "45%" },
  signLine: { borderTopWidth: 0.5, borderTopColor: "#9ca3af", marginTop: 36, paddingTop: 4, fontSize: 9, color: "#6b7280" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
});

const CAT_LABEL: Record<string, string> = {
  hiz_regulatoru: "Hız Regülatörü",
  tampon: "Tampon",
  tampon_kabin: "Kabin Tamponu",
  tampon_agirlik: "Ağırlık Tamponu",
  kapi_kilidi: "Kapı Kilidi",
  kabin_kilidi: "Kabin Kapı Kilidi",
  fren_blogu: "Fren Bloğu",
  kumanda: "Kumanda Panosu",
  motor: "Makine Motoru",
};

function Field({ label, value }: { label: string; value?: any }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value !== undefined && value !== null && value !== "" ? String(value) : "—"}</Text>
    </View>
  );
}

export function UygunlukBeyaniDoc({ data }: { data: any }) {
  const d = data || {};
  const firma = d.firma || {};
  const modul = d.firma_modul || {};
  const muh = d.muhendis || {};
  const kap = d.kapasite || {};
  const ekipman: Record<string, any> = d.ekipman || {};
  const bugun = new Date().toLocaleDateString("tr-TR");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topRow}>
          <Text>Dosya No: {d.dosya_no || "—"}</Text>
          <Text>Tarih: {d.dosya_tarihi || bugun}</Text>
        </View>

        <Text style={s.firma}>{firma.unvan || firma.kisa_ad || "—"}</Text>
        <Text style={s.firmaSub}>
          {[firma.adres, firma.sehir].filter(Boolean).join(" · ") || " "}
        </Text>

        <Text style={s.title}>UYGUNLUK BEYANI</Text>
        <View style={s.titleRule} />

        <Text style={s.intro}>
          Aşağıda teknik bilgileri verilen asansörün; 2014/33/AB Asansör Yönetmeliği ve ilgili
          uyumlaştırılmış standartlar (TS EN 81-20 / TS EN 81-50) hükümlerine uygun olarak
          tasarlandığını, imal ve monte edildiğini beyan ederiz. İşbu beyan,{" "}
          {firma.unvan || "firma"} sorumluluğunda düzenlenmiştir.
        </Text>

        <Text style={s.sectionTitle}>Asansör Bilgileri</Text>
        <Field label="Bina / İl" value={[d.bina_adi, d.il].filter(Boolean).join(" · ")} />
        <Field label="Beyan Yükü" value={d.beyan_yuku_kg ? `${d.beyan_yuku_kg} kg` : undefined} />
        <Field label="Kişi Sayısı" value={d.kisi_sayisi ?? kap.kisi} />
        <Field label="Beyan Hızı" value={d.beyan_hizi ? `${d.beyan_hizi} m/s` : undefined} />
        <Field label="Kat / Durak Adedi" value={`${d.kat_adedi ?? "—"} / ${d.durak_adedi ?? "—"}`} />
        <Field label="İmal Yılı" value={d.imal_yili} />

        <Text style={s.sectionTitle}>Belgelendirme</Text>
        <Field label="Uygunluk Modülü" value={d.modul} />
        <Field label="Onaylanmış Kuruluş" value={modul.onaylanmis_kurulus} />
        <Field label="Onaylanmış Kuruluş No" value={modul.kurulus_no} />
        <Field label="Modül Belge No" value={modul.belge_no} />
        <Field label="Sanayi Sicil No" value={firma.sanayi_sicil_no} />

        <Text style={s.sectionTitle}>Kritik Güvenlik Ekipmanları</Text>
        {Object.keys(ekipman).length === 0 ? (
          <Text style={{ color: "#9ca3af" }}>Seçili ekipman yok.</Text>
        ) : (
          Object.entries(ekipman).map(([code, e]) => (
            <View style={s.eqRow} key={code}>
              <Text style={s.eqCat}>{CAT_LABEL[code] || code}</Text>
              <Text style={s.eqVal}>
                {[e?.marka, e?.model].filter(Boolean).join(" ") || "—"}
              </Text>
              <Text style={s.eqCert}>
                {e?.sertifika_no ? `Sert: ${e.sertifika_no}` : ""}
                {e?.kurulus_no ? ` · ${e.kurulus_no}` : ""}
              </Text>
            </View>
          ))
        )}

        <Text style={s.sectionTitle}>Sorumlu Mühendisler</Text>
        <Field
          label="Makine Mühendisi"
          value={[muh.makine?.ad, muh.makine?.oda_sicil].filter(Boolean).join(" · ")}
        />
        <Field
          label="Elektrik Mühendisi"
          value={[muh.elektrik?.ad, muh.elektrik?.oda_sicil].filter(Boolean).join(" · ")}
        />

        <View style={s.signWrap}>
          <View style={s.signBox}>
            <Text style={s.signLine}>Firma Yetkilisi</Text>
            <Text style={{ fontSize: 9 }}>{firma.yetkili || " "}</Text>
          </View>
          <View style={s.signBox}>
            <Text style={s.signLine}>Kaşe / İmza</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Bu belge {firma.unvan || ""} adına Gensis Teknik Dosya platformu ile üretilmiştir · {bugun}
        </Text>
      </Page>
    </Document>
  );
}
