import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { TEKNIK_DOSYA_BELGELERI } from "./belgeler";
import { KULLANIM_KLAVUZU, BAKIM_KLAVUZU, SON_KONTROL } from "./belge_icerik";

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
});

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
  return { d, firma, modul, muh, kap, inp, ekipman, bugun, tarih, fname, kisi, adaParsel, eqEntries };
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

  tescil: (c) => (
    <Page key="tescil" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="YENİ ASANSÖR İÇİN TESCİL BELGESİ (EK-1)" />
      <R l="Tescil Tarihi" val={c.tarih} />
      <R l="Tescili Yapan İdare" val={c.d.belediye ? `${v(c.d.belediye)} Belediyesi` : undefined} />
      <Text style={st.sec}>Asansör Monte Edene Dair Bilgiler</Text>
      <R l="Adı / Ünvanı" val={c.firma.unvan} />
      <R l="Adresi" val={c.firma.adres} />
      <R l="İletişim" val={[c.firma.telefon, c.firma.faks].filter(Boolean).join(" · ")} />
      <Text style={st.sec}>Asansöre Dair Bilgiler</Text>
      <R l="Asansör Kimlik No" val={c.inp.asansor_kimlik_no} />
      <R l="Ada / Parsel No" val={c.adaParsel} />
      <R l="Montaj Adresi" val={c.d.montaj_adresi} />
      <R l="Markası" val={c.firma.tescilli_marka} />
      <R l="Seri Numarası" val={c.inp.asansor_seri_no} />
      <R l="İmal Yılı" val={c.d.imal_yili} />
      <R l="Tahrik Türü" val="ELEKTRİKLİ DİREKT TAHRİK" />
      <R l="Hızı" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : undefined} />
      <R l="Kapasite / Beyan Yükü" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} kg` : undefined} />
      <R l="Durak Sayısı" val={c.d.durak_adedi} />
      <Text style={st.sec}>Mevzuat</Text>
      <R l="Yönetmelik" val="ASANSÖR YÖNETMELİĞİ (2014/33/AB)" />
      <Footer firma={c.fname} />
    </Page>
  ),

  garanti: (c) => (
    <Page key="garanti" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="GARANTİ BELGESİ (EK-3)" />
      <R l="Belge Düzenleme Tarihi" val={c.tarih} />
      <R l="Ünvanı" val={c.firma.unvan} />
      <R l="Adresi" val={c.firma.adres} />
      <R l="Telefon / Faks" val={[c.firma.telefon, c.firma.faks].filter(Boolean).join(" · ")} />
      <Text style={st.sec}>Malın</Text>
      <R l="Cinsi" val="ELEKTRİKLİ DİREKT TAHRİK" />
      <R l="Markası" val={c.firma.tescilli_marka} />
      <R l="Teslim Tarihi" val={c.tarih} />
      <R l="Teslim Adresi" val={c.d.montaj_adresi} />
      <R l="Ada / Parsel No" val={c.adaParsel} />
      <R l="Azami Tamir Süresi" val="15 GÜN" />
      <R l="Garanti Süresi" val="3 YIL" />
      <Text style={st.sec}>Onay</Text>
      <R l="Firma Yetkilisi" val={c.firma.yetkili} />
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

  muh_taahhut: (c) => (
    <Page key="muh_taahhut" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="TAAHHÜTNAME" />
      <Text style={st.sec}>Makine Mühendisi (Proje Müellifi)</Text>
      <R l="Adı Soyadı" val={c.muh.makine?.ad} />
      <R l="Oda Sicil No" val={c.muh.makine?.oda_sicil} />
      <R l="Ünvanı" val="Makina Mühendisi" />
      <Text style={st.sec}>Elektrik Mühendisi (Proje Müellifi)</Text>
      <R l="Adı Soyadı" val={c.muh.elektrik?.ad} />
      <R l="Oda Sicil No" val={c.muh.elektrik?.oda_sicil} />
      <R l="Ünvanı" val="Elektrik Mühendisi" />
      <Text style={st.sec}>Müellifliği Üstlenilen Proje</Text>
      <R l="İl / İlçe" val={[c.d.il, c.d.belediye].filter(Boolean).join(" / ")} />
      <R l="İlgili İdare" val={c.d.belediye ? `${v(c.d.belediye)} Belediyesi` : undefined} />
      <R l="Pafta / Ada / Parsel" val={[c.inp.pafta, c.inp.ada, c.inp.parsel].filter(Boolean).join(" / ")} />
      <Text style={st.p}>
        Yukarıda bilgileri verilen projenin müellifi olarak, ilgili mevzuat ve standartlara uygun
        şekilde hazırlandığını taahhüt ederiz.
      </Text>
      <Footer firma={c.fname} />
    </Page>
  ),

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
      <R l="Asansörün Tipi" val="ELEKTRİKLİ DİREKT TAHRİK" />
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

  teknik_komponent: (c) => (
    <Page key="teknik_komponent" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="ASANSÖR TEKNİK ÖZELLİKLERİ & GÜVENLİK EKİPMANLARI LİSTESİ" />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Asansörün Tipi" val="Elektrikli İnsan Asansörü" />
      <R l="Yapım Yılı" val={c.d.imal_yili} />
      <R l="Beyan Yükü" val={c.d.beyan_yuku_kg ? `${c.d.beyan_yuku_kg} Kg` : undefined} />
      <R l="Beyan Hızı" val={c.d.beyan_hizi ? `${c.d.beyan_hizi} m/s` : undefined} />
      <R l="Kat / Durak Adedi" val={`${v(c.d.kat_adedi)} / ${v(c.d.durak_adedi)}`} />
      <R l="Kat Kapısı" val={c.inp.kat_kapisi} />
      <R l="Askı Tipi" val={c.inp.aski_tipi} />
      <Text style={st.sec}>Güvenlik Ekipmanları</Text>
      {c.eqEntries.length === 0 ? (
        <Text style={{ color: "#9ca3af" }}>Seçili ekipman yok.</Text>
      ) : (
        c.eqEntries.map(([code, e]) => (
          <View style={st.eqRow} key={code}>
            <Text style={st.eqA}>{CAT_LABEL[code] || code}</Text>
            <Text style={st.eqB}>{[e?.marka, e?.model].filter(Boolean).join(" ") || "—"}</Text>
            <Text style={st.eqC}>{e?.sertifika_no ? `Sert: ${e.sertifika_no}` : ""}</Text>
          </View>
        ))
      )}
      <Footer firma={c.fname} />
    </Page>
  ),

  motor_beyannamesi: (c) => (
    <Page key="motor_beyannamesi" size="A4" style={st.page}>
      <View style={st.topRow}><Text> </Text><Text>Tarih: {c.tarih}</Text></View>
      <Text style={{ textAlign: "center", fontWeight: "bold", color: NAVY, fontSize: 12, marginBottom: 2 }}>MOTOR BEYANNAMESİ</Text>
      <Text style={{ textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
        {v(c.d.belediye).toUpperCase()} BELEDİYE BAŞKANLIĞI RUHSAT VE DENETİM MÜDÜRLÜĞÜ
      </Text>
      <Text style={st.p}>
        {v(c.d.montaj_adresi)} adresinde, {v(c.inp.pafta)} pafta {v(c.inp.ada)} ada {v(c.inp.parsel)} parsel
        sayılı yerde bulunan elektrik motorunun fenni ve teknik şartlara uygun olarak kullanılacağını beyan ederiz.
      </Text>
      <Text style={st.sec}>Motorun Özellikleri</Text>
      <R l="Motor Markası" val={c.ekipman.motor?.marka} />
      <R l="Motor Modeli" val={c.ekipman.motor?.model} />
      <R l="Motor Seri No" val={c.inp.motor_seri_no} />
      <R l="Motor Gücü" val={c.inp.motor_gucu ? `${c.inp.motor_gucu} kW` : undefined} />
      <Text style={{ marginTop: 16, textAlign: "right" }}>SAYGILARIMIZLA</Text>
      <Footer firma={c.fname} />
    </Page>
  ),

  seyir_defteri: (c) => (
    <Page key="seyir_defteri" size="A4" style={st.page}>
      <DocHead firma={c.firma} title="ASANSÖR SEYİR DEFTERİ" />
      <R l="Asansörün Sahibi" val={c.inp.yapi_sahibi} />
      <R l="Asansör Sahibinin Adresi" val={c.inp.yapi_sahibi_adresi} />
      <R l="Asansörün Bulunduğu Adres" val={c.d.montaj_adresi} />
      <R l="Asansör Seri No" val={c.inp.asansor_seri_no} />
      <R l="Yapımcı Firma" val={c.firma.unvan} />
      <R l="Servise Verildiği Tarih" val={c.tarih} />
      <Text style={st.sec}>Yasal ve Periyodik Kontroller</Text>
      <Text style={{ color: "#9ca3af" }}>
        (Periyodik kontrol, revizyon ve önemli olay kayıtları için bu bölüm boş bırakılmıştır.)
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
      ].map((t, i) => (
        <View style={st.listRow} key={i}>
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
      {KULLANIM_KLAVUZU.map((t, i) => (
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
      {BAKIM_KLAVUZU.map((t, i) => (
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
