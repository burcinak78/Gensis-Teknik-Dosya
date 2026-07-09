import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Birleşik Teknik Dosya — görünür belgeleri tek PDF'te birleştirir.
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
});

const CAT_LABEL: Record<string, string> = {
  hiz_regulatoru: "Hız Regülatörü", tampon: "Tampon", tampon_kabin: "Kabin Tamponu",
  tampon_agirlik: "Ağırlık Tamponu", kapi_kilidi: "Kapı Kilidi", kabin_kilidi: "Kabin Kapı Kilidi",
  fren_blogu: "Fren Bloğu", kumanda: "Kumanda Panosu", motor: "Makine Motoru",
};

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

export function TeknikDosyaDoc({ data }: { data: any }) {
  const d = data || {};
  const firma = d.firma || {};
  const modul = d.firma_modul || {};
  const muh = d.muhendis || {};
  const kap = d.kapasite || {};
  const inp = d.input_data || d; // input_data alanları
  const ekipman: Record<string, any> = d.ekipman || {};
  const bugun = new Date().toLocaleDateString("tr-TR");
  const tarih = d.dosya_tarihi || bugun;
  const fname = v(firma.unvan || firma.kisa_ad);
  const kisi = d.kisi_sayisi ?? kap.kisi;
  const adaParsel = [inp.ada, inp.parsel].filter(Boolean).join(" / ");

  const eqEntries = Object.entries(ekipman);

  return (
    <Document>
      {/* 1 — KAPAK */}
      <Page size="A4" style={st.page}>
        <View style={st.coverWrap}>
          <Text style={st.coverBig}>TEKNİK DOSYA</Text>
          <Text style={st.coverSub}>2014/33 AB ASANSÖR YÖNETMELİĞİ</Text>
          <R l="Dosya No" val={d.dosya_no} />
          <View style={{ height: 10 }} />
          <R l="Asansör Seri No" val={inp.asansor_seri_no} />
          <R l="Bina Adı" val={d.bina_adi} />
          <R l="Bina Adresi" val={d.montaj_adresi} />
          <R l="Pafta / Ada / Parsel" val={[inp.pafta, inp.ada, inp.parsel].filter(Boolean).join(" / ")} />
          <View style={{ height: 24 }} />
          <Text style={st.firmaName}>{fname}</Text>
          <Text style={{ fontSize: 9, color: "#6b7280" }}>{tarih}</Text>
        </View>
      </Page>

      {/* 2 — DİLEKÇE */}
      <Page size="A4" style={st.page}>
        <View style={st.topRow}><Text> </Text><Text>{tarih}</Text></View>
        <Text style={{ textAlign: "center", fontWeight: "bold", color: NAVY, fontSize: 12, marginBottom: 4 }}>
          {v(d.belediye).toUpperCase()} BELEDİYE BAŞKANLIĞI'NA
        </Text>
        <Text style={{ textAlign: "center", color: "#6b7280", marginBottom: 18 }}>{v(d.il)}</Text>
        <Text style={st.p}>
          Aşağıda özellikleri verilmiş olan ve firmamız tarafından montajı yapılan 1 adet asansör için
          tescil belgesinin tarafımıza verilmesini arz ederiz.
        </Text>
        <R l="Yapı Sahibi" val={inp.yapi_sahibi} />
        <R l="Montaj Adresi" val={d.montaj_adresi} />
        <R l="Pafta" val={inp.pafta} />
        <R l="Ada" val={inp.ada} />
        <R l="Parsel" val={inp.parsel} />
        <R l="Beyan Yükü" val={d.beyan_yuku_kg ? `${d.beyan_yuku_kg} Kg. · ${v(kisi)} Kişi` : undefined} />
        <R l="Beyan Hızı" val={d.beyan_hizi ? `${d.beyan_hizi} m/s` : undefined} />
        <R l="Durak Sayısı" val={d.durak_adedi} />
        <Text style={{ marginTop: 20 }}>Saygılarımızla,</Text>
        <View style={st.signWrap}>
          <View />
          <View style={st.signBox}>
            <Text style={{ fontWeight: "bold" }}>{fname}</Text>
            <Text style={st.signLine}>Kaşe / İmza</Text>
          </View>
        </View>
        <Footer firma={fname} />
      </Page>

      {/* 3 — FİRMA BİLGİLERİ */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="FİRMA BİLGİLERİ" />
        <R l="Ticari Ünvan" val={firma.unvan} />
        <R l="Tescilli Marka" val={firma.tescilli_marka} />
        <R l="Yetkili / Ünvanı" val={firma.yetkili} />
        <R l="Adres" val={firma.adres} />
        <R l="Yer" val={firma.sehir} />
        <R l="Ülke" val="TÜRKİYE" />
        <R l="Telefon" val={firma.telefon} />
        <R l="Faks" val={firma.faks} />
        <R l="Sanayi Sicil No" val={firma.sanayi_sicil_no} />
        <R l="CE İşaretlemesi Sorumlusu" val={muh.makine?.ad || firma.yetkili} />
        <Footer firma={fname} />
      </Page>

      {/* 4 — UYGUNLUK BEYANI */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="UYGUNLUK BEYANI" />
        <Text style={st.p}>
          Aşağıda teknik bilgileri verilen asansörün; 2014/33/AB Asansör Yönetmeliği ve ilgili
          uyumlaştırılmış standartlar (TS EN 81-20 / TS EN 81-50) hükümlerine uygun olarak tasarlandığını,
          imal ve monte edildiğini beyan ederiz.
        </Text>
        <Text style={st.sec}>Asansör Bilgileri</Text>
        <R l="Bina / İl" val={[d.bina_adi, d.il].filter(Boolean).join(" · ")} />
        <R l="Beyan Yükü" val={d.beyan_yuku_kg ? `${d.beyan_yuku_kg} kg` : undefined} />
        <R l="Kişi Sayısı" val={kisi} />
        <R l="Beyan Hızı" val={d.beyan_hizi ? `${d.beyan_hizi} m/s` : undefined} />
        <R l="Kat / Durak" val={`${v(d.kat_adedi)} / ${v(d.durak_adedi)}`} />
        <Text style={st.sec}>Belgelendirme</Text>
        <R l="Uygunluk Modülü" val={d.modul} />
        <R l="Onaylanmış Kuruluş" val={modul.onaylanmis_kurulus} />
        <R l="Modül Belge No" val={modul.belge_no} />
        <Footer firma={fname} />
      </Page>

      {/* 5 — YAZILI BEYANNAME */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="BEYANNAME" />
        <R l="Asansör Seri No" val={inp.asansor_seri_no} />
        <R l="Asansörün Tipi" val="ELEKTRİKLİ DİREKT TAHRİK" />
        <R l="Yapım Yılı" val={d.imal_yili} />
        <R l="Seyir Mesafesi" val={inp.seyir_mesafesi ? `${inp.seyir_mesafesi} m` : undefined} />
        <R l="Beyan Yükü" val={d.beyan_yuku_kg ? `${d.beyan_yuku_kg} Kg` : undefined} />
        <R l="Beyan Hızı" val={d.beyan_hizi ? `${d.beyan_hizi} m/s` : undefined} />
        <R l="Kat / Durak Adedi" val={`${v(d.kat_adedi)} / ${v(d.durak_adedi)}`} />
        <R l="Ada / Parsel" val={adaParsel} />
        <R l="Asansör Adresi" val={d.montaj_adresi} />
        <R l="Firma Adı / Ünvanı" val={firma.unvan} />
        <R l="Firma Adresi" val={firma.adres} />
        <R l="Firma Yetkilisi" val={firma.yetkili} />
        <Text style={{ marginTop: 12, fontSize: 9, color: "#6b7280" }}>
          İş bu evrak; 03.04.2021 tarihli, 31443 sayılı Resmî Gazete kapsamında düzenlenmiştir.
        </Text>
        <View style={st.signWrap}>
          <View />
          <View style={st.signBox}>
            <Text style={{ fontWeight: "bold" }}>{v(firma.yetkili)}</Text>
            <Text style={st.signLine}>Kaşe / İmza</Text>
          </View>
        </View>
        <Footer firma={fname} />
      </Page>

      {/* 6 — TEKNİK & KOMPONENT LİSTESİ */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="ASANSÖR TEKNİK ÖZELLİKLERİ & GÜVENLİK EKİPMANLARI LİSTESİ" />
        <R l="Asansör Seri No" val={inp.asansor_seri_no} />
        <R l="Asansörün Tipi" val="Elektrikli İnsan Asansörü" />
        <R l="Yapım Yılı" val={d.imal_yili} />
        <R l="Beyan Yükü" val={d.beyan_yuku_kg ? `${d.beyan_yuku_kg} Kg` : undefined} />
        <R l="Beyan Hızı" val={d.beyan_hizi ? `${d.beyan_hizi} m/s` : undefined} />
        <R l="Kat / Durak Adedi" val={`${v(d.kat_adedi)} / ${v(d.durak_adedi)}`} />
        <R l="Kat Kapısı" val={inp.kat_kapisi} />
        <R l="Askı Tipi" val={inp.aski_tipi} />
        <Text style={st.sec}>Güvenlik Ekipmanları</Text>
        {eqEntries.length === 0 ? (
          <Text style={{ color: "#9ca3af" }}>Seçili ekipman yok.</Text>
        ) : (
          eqEntries.map(([code, e]) => (
            <View style={st.eqRow} key={code}>
              <Text style={st.eqA}>{CAT_LABEL[code] || code}</Text>
              <Text style={st.eqB}>{[e?.marka, e?.model].filter(Boolean).join(" ") || "—"}</Text>
              <Text style={st.eqC}>{e?.sertifika_no ? `Sert: ${e.sertifika_no}` : ""}</Text>
            </View>
          ))
        )}
        <Footer firma={fname} />
      </Page>

      {/* 7 — MOTOR BEYANNAMESİ */}
      <Page size="A4" style={st.page}>
        <View style={st.topRow}><Text> </Text><Text>Tarih: {tarih}</Text></View>
        <Text style={{ textAlign: "center", fontWeight: "bold", color: NAVY, fontSize: 12, marginBottom: 2 }}>MOTOR BEYANNAMESİ</Text>
        <Text style={{ textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
          {v(d.belediye).toUpperCase()} BELEDİYE BAŞKANLIĞI RUHSAT VE DENETİM MÜDÜRLÜĞÜ
        </Text>
        <Text style={st.p}>
          {v(d.montaj_adresi)} adresinde, {v(inp.pafta)} pafta {v(inp.ada)} ada {v(inp.parsel)} parsel sayılı yerde
          bulunan elektrik motorunun fenni ve teknik şartlara uygun olarak kullanılacağını beyan ederiz.
        </Text>
        <Text style={st.sec}>Motorun Özellikleri</Text>
        <R l="Motor Markası" val={ekipman.motor?.marka} />
        <R l="Motor Modeli" val={ekipman.motor?.model} />
        <R l="Motor Seri No" val={inp.motor_seri_no} />
        <R l="Motor Gücü" val={inp.motor_gucu} />
        <Text style={{ marginTop: 16, textAlign: "right" }}>SAYGILARIMIZLA</Text>
        <Footer firma={fname} />
      </Page>

      {/* 8 — GARANTİ BELGESİ */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="GARANTİ BELGESİ (EK-3)" />
        <R l="Belge Düzenleme Tarihi" val={tarih} />
        <R l="Ünvanı" val={firma.unvan} />
        <R l="Adresi" val={firma.adres} />
        <R l="Telefon / Faks" val={[firma.telefon, firma.faks].filter(Boolean).join(" · ")} />
        <Text style={st.sec}>Malın</Text>
        <R l="Cinsi" val="ELEKTRİKLİ DİREKT TAHRİK" />
        <R l="Markası" val={firma.tescilli_marka} />
        <R l="Teslim Tarihi" val={tarih} />
        <R l="Teslim Adresi" val={d.montaj_adresi} />
        <R l="Ada / Parsel No" val={adaParsel} />
        <R l="Azami Tamir Süresi" val="15 GÜN" />
        <R l="Garanti Süresi" val="3 YIL" />
        <Text style={st.sec}>Onay</Text>
        <R l="Firma Yetkilisi" val={firma.yetkili} />
        <Footer firma={fname} />
      </Page>

      {/* 9 — EĞİTİM TUTANAĞI */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="ASANSÖRDE MAHSUR KALAN KİŞİLERİN KURTARILMASI EĞİTİMİ" />
        <R l="Asansör Seri No" val={inp.asansor_seri_no} />
        <R l="Asansörün Bulunduğu Adres" val={d.montaj_adresi} />
        <R l="Asansörün Sahibi" val={inp.yapi_sahibi} />
        <Text style={st.p}>
          Aşağıda listede ismi bulunan kişilere, yetkili kişi tarafından asansörde mahsur kalan
          kişilerin kurtarılmasına yönelik eğitim verilmiştir.
        </Text>
        <View style={st.signWrap}>
          <View style={st.signBox}><Text style={st.signLine}>Eğitimi Veren (İsim / İmza)</Text></View>
          <View style={st.signBox}><Text style={st.signLine}>Eğitimi Alan (İsim / İmza)</Text></View>
        </View>
        <Text style={{ marginTop: 14, color: "#6b7280" }}>Tarih: {tarih}</Text>
        <Footer firma={fname} />
      </Page>

      {/* 10 — TESLİM TUTANAĞI */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="ASANSÖR ve DOKÜMAN TESLİM TUTANAĞI" />
        <R l="Asansör Seri No" val={inp.asansor_seri_no} />
        <R l="Asansörün Bulunduğu Adres" val={d.montaj_adresi} />
        <R l="Asansörün Sahibi" val={inp.yapi_sahibi} />
        <Text style={st.sec}>Asansör Sahibine Verilen Doküman Listesi</Text>
        {[
          "AT Uygunluk Beyanı", "Asansör Teknik Özellikleri", "Güvenlik Ekipmanları Listesi",
          "Asansör Projesi", "Güvenlik Ekipmanları CE ve Test Belgeleri",
          "Güvenlik Ekipmanları Kullanma Kılavuzları, Şema ve Diyagramları",
          "Asansör Kullanma Kılavuzu", "Asansör Kurtarma Talimatı", "Asansör Seyir Defteri",
        ].map((t, i) => (
          <View style={st.listRow} key={i}>
            <Text style={st.listNo}>{i + 1}.</Text>
            <Text>{t}</Text>
          </View>
        ))}
        <Text style={st.p}>
          Yukarıda belirtilen dokümanları eksiksiz ve asansörü/asansörleri çalışır durumda teslim aldım.
        </Text>
        <Text style={{ marginTop: 8, color: "#6b7280" }}>Tarih: {tarih}</Text>
        <Footer firma={fname} />
      </Page>

      {/* 11 — SONRAKİ PARTİDE EKLENECEK */}
      <Page size="A4" style={st.page}>
        <DocHead firma={firma} title="EK BELGELER" />
        <Text style={st.p}>
          Aşağıdaki belgeler teknik dosyanın parçasıdır ve bir sonraki güncellemede bu dosyaya dahil edilecektir:
        </Text>
        {[
          "Tescil Belgesi", "Bakım Sözleşmesi", "Mühendis Taahhütnamesi",
          "Kullanım Kılavuzu", "Bakım Kılavuzu", "Seyir Defteri",
          "Son Kontrol Formu", "Seçili ekipmanların ürün sertifikaları (PDF ekleri)",
        ].map((t, i) => (
          <View style={st.listRow} key={i}>
            <Text style={st.listNo}>•</Text>
            <Text>{t}</Text>
          </View>
        ))}
        <Footer firma={fname} />
      </Page>
    </Document>
  );
}
