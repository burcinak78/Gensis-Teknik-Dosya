// Teknik dosyadaki belgelerin sıralı listesi (tek kaynak).
// Hem PDF üretici (TeknikDosyaDoc) hem de arayüz (proje detay sayfası) bunu kullanır.

export type BelgeMeta = { code: string; title: string; hazir: boolean };

export const TEKNIK_DOSYA_BELGELERI: BelgeMeta[] = [
  { code: "kapak", title: "Kapak", hazir: true },
  { code: "dilekce", title: "Dilekçe", hazir: true },
  { code: "firma_bilgileri", title: "Firma Bilgileri", hazir: true },
  { code: "tescil", title: "Tescil Belgesi", hazir: true },
  { code: "garanti", title: "Garanti Belgesi", hazir: true },
  { code: "bakim_sozlesmesi", title: "Bakım Sözleşmesi", hazir: true },
  { code: "muh_taahhut_makine", title: "Mühendis Taahhütnamesi (Makine)", hazir: true },
  { code: "muh_taahhut_elektrik", title: "Mühendis Taahhütnamesi (Elektrik)", hazir: true },
  { code: "uygunluk_beyani", title: "Uygunluk Beyanı", hazir: true },
  { code: "yazili_beyanname", title: "Yazılı Beyanname", hazir: true },
  { code: "teknik_komponent", title: "Teknik & Komponent Listesi", hazir: true },
  { code: "motor_beyannamesi", title: "Motor Beyannamesi", hazir: true },
  { code: "son_kontrol_formu", title: "Son Kontrol Formu", hazir: true },
  { code: "kullanim_klavuzu", title: "Kullanım Kılavuzu", hazir: true },
  { code: "bakim_klavuzu", title: "Bakım Kılavuzu", hazir: true },
  { code: "seyir_defteri", title: "Seyir Defteri", hazir: true },
  { code: "egitim_tutanagi", title: "Eğitim Tutanağı", hazir: true },
  { code: "teslim_tutanagi", title: "Teslim Tutanağı", hazir: true },
];
