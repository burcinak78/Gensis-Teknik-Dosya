"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MODULES = [
  { code: "M-01", title: "Teknik Dosya Üretimi", desc: "Verilerden imzaya hazır CE teknik dosyası ve PDF çıktısı." },
  { code: "M-02", title: "Firma & Belge Yönetimi", desc: "Firma dokümanları (Sanayi Sicil, TSE HYB, CE Mod H1/B/E, İmza Sirküleri vb.) tek yerde." },
  { code: "M-03", title: "Yetkili Mühendisler", desc: "Makine/Elektrik mühendisleri ve yetki belgelerinin merkezî yönetimi." },
  { code: "M-04", title: "Güvenlik Ekipmanları & Sertifikalar", desc: "Ekipman-model-sertifika ilişkisi, onaylanmış kuruluş kayıtları." },
  { code: "M-05", title: "Bildirimler", desc: "Süresi dolan/dolmak üzere olan belgeler için otomatik uyarı." },
  { code: "M-06", title: "Proje Takip", desc: "Projelerin durum, sorumlu ve tarih bazında takibi; montaj firması ilişkilendirme." },
  { code: "M-07", title: "Muhasebe", desc: "Tamamlanan projelerin faturalama ve teslim süreçlerinin takibi." },
  { code: "M-08", title: "Rol Bazlı Erişim", desc: "Admin, Kullanıcı, Muhasebe/Finans ve Müşteri rolleriyle güvenli yetkilendirme." },
];

const MONO = "'IBM Plex Mono',monospace";
const HEAD = "'Changa',sans-serif";

export default function GirisPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError("Giriş başarısız: " + error.message); return; }
    router.push("/");
    router.refresh();
  }

  async function handleReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) { setError("Şifre sıfırlamak için önce e-posta adresinizi girin."); return; }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/sifre-yenile`,
    });
    setResetting(false);
    if (error) { setError("Sıfırlama bağlantısı gönderilemedi: " + error.message); return; }
    setNotice("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.");
  }

  const p1 = yearly ? "1.190" : "1.490";
  const p2 = yearly ? "2.790" : "3.490";
  const billNote = yearly ? "Yıllık faturalandırılır" : "Aylık faturalandırılır";

  return (
    <div className="lp" style={{ minHeight: "100vh", background: "#F6F8FB", color: "#111418", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Changa:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .lp *{box-sizing:border-box}
        .lp a{text-decoration:none;color:#005CFF}
        .lp-navlink{color:#3A4250 !important;transition:color .15s}
        .lp-navlink:hover{color:#005CFF !important}
        .lp-btn{transition:background .15s,color .15s,border-color .15s}
        .lp-primary:hover{background:#0042B8 !important;color:#fff !important}
        .lp-outline:hover{background:#111418 !important;color:#fff !important}
        .lp-white:hover{background:#111418 !important;color:#fff !important}
        .lp-mod:hover{background:#EAF1FF !important}
        .lp-input{transition:border-color .12s,background .12s}
        .lp-input:focus{border-color:#005CFF !important;background:#fff !important;outline:none}
        html{scroll-behavior:smooth}
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)", borderBottom: "1px solid #DCE3EE" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10, color: "#111418" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-icon.png" alt="" style={{ height: 30, width: "auto", mixBlendMode: "multiply" }} />
            <span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 21, letterSpacing: "0.06em" }}>DOSYALIFT</span>
          </a>
          <nav style={{ display: "flex", gap: 28, flexWrap: "wrap", fontSize: 15, fontWeight: 500 }}>
            <a className="lp-navlink" href="#ozellikler">Özellikler</a>
            <a className="lp-navlink" href="#nasil">Nasıl çalışır</a>
            <a className="lp-navlink" href="#moduller">Modüller</a>
            <a className="lp-navlink" href="#paketler">Paketler</a>
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a className="lp-btn lp-outline" href="#giris" style={{ padding: "9px 16px", border: "1.5px solid #111418", color: "#111418", fontFamily: HEAD, fontWeight: 600, fontSize: 15, borderRadius: 4 }}>Giriş yap</a>
            <a className="lp-btn lp-primary" href="#demo" style={{ padding: "9px 16px", background: "#005CFF", color: "#fff", fontFamily: HEAD, fontWeight: 600, fontSize: 15, borderRadius: 4, border: "1.5px solid #005CFF" }}>Demo talep et</a>
          </div>
        </div>
      </header>

      {/* Hero + Login */}
      <section id="top" style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid #DCE3EE" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(0,92,255,0.10) 1px,transparent 1px),linear-gradient(90deg,rgba(0,92,255,0.10) 1px,transparent 1px),linear-gradient(rgba(0,92,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(0,92,255,0.045) 1px,transparent 1px)", backgroundSize: "120px 120px,120px 120px,24px 24px,24px 24px", backgroundPosition: "-1px -1px" }} />
        <div style={{ position: "relative", maxWidth: 1240, margin: "0 auto", padding: "88px 28px 96px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 13, color: "#0042B8", letterSpacing: "0.04em" }}>
              <span style={{ width: 28, height: 1.5, background: "#005CFF" }} />
              <span>ASANSÖR CE TEKNİK DOSYA PLATFORMU</span>
            </div>
            <h1 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(44px,6vw,76px)", lineHeight: 0.98, letterSpacing: "-0.01em" }}>Veri girişinden imzalı PDF&apos;e, <span style={{ color: "#005CFF" }}>tek akışta.</span></h1>
            <p style={{ margin: 0, maxWidth: 540, fontSize: 19, lineHeight: 1.55, color: "#3A4250" }}>Asansör CE teknik dosyasını saatler süren manuel işten, dakikalar süren güvenilir bir akışa dönüştürür.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="lp-btn lp-primary" href="#paketler" style={{ padding: "15px 24px", background: "#005CFF", color: "#fff", fontFamily: HEAD, fontWeight: 600, fontSize: 17, borderRadius: 4 }}>Paketleri incele</a>
              <a className="lp-btn lp-outline" href="#nasil" style={{ padding: "15px 24px", background: "#fff", color: "#111418", border: "1.5px solid #111418", fontFamily: HEAD, fontWeight: 600, fontSize: 17, borderRadius: 4 }}>Nasıl çalışır?</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,auto)", justifyContent: "start", marginTop: 12, borderTop: "1px solid #C9D3E3", paddingTop: 20, fontFamily: MONO, fontSize: 12, color: "#5A6474", columnGap: 36, rowGap: 6 }}>
              <span>STANDART</span><span>İZLENEBİLİR</span><span>DENETİME HAZIR</span>
            </div>
          </div>

          {/* Login form */}
          <div id="giris" style={{ justifySelf: "end", width: "100%", maxWidth: 440, position: "relative" }}>
            <div style={{ position: "absolute", left: -18, top: 0, bottom: 0, width: 1, background: "#005CFF" }} />
            <div style={{ position: "absolute", left: -24, top: 0, width: 13, height: 1, background: "#005CFF" }} />
            <div style={{ position: "absolute", left: -24, bottom: 0, width: 13, height: 1, background: "#005CFF" }} />
            <div style={{ position: "absolute", left: -36, top: "50%", transform: "translate(-50%,-50%) rotate(-90deg)", fontFamily: MONO, fontSize: 11, color: "#005CFF", background: "#F6F8FB", padding: "0 6px", whiteSpace: "nowrap" }}>KULLANICI GİRİŞİ</div>

            <form onSubmit={handleLogin} style={{ background: "#fff", border: "2px solid #111418", boxShadow: "8px 8px 0 #005CFF" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", borderBottom: "2px solid #111418", fontFamily: MONO, fontSize: 11, color: "#3A4250" }}>
                <div style={{ padding: "10px 14px", borderRight: "1px solid #111418" }}>PROJE<br /><b style={{ color: "#111418", fontSize: 12 }}>MÜŞTERİ PANELİ</b></div>
                <div style={{ padding: "10px 14px", borderRight: "1px solid #111418" }}>PAFTA<br /><b style={{ color: "#111418", fontSize: 12 }}>01/01</b></div>
                <div style={{ padding: "10px 14px" }}>ÖLÇEK<br /><b style={{ color: "#111418", fontSize: 12 }}>1:1</b></div>
              </div>
              <div style={{ padding: "28px 28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: 28 }}>Hesabınıza giriş yapın</h2>
                  <p style={{ margin: 0, fontSize: 14, color: "#5A6474" }}>Projelerinize, belgelerinize ve dosyalarınıza devam edin.</p>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#3A4250" }}>E-posta
                  <input className="lp-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@firma.com.tr" style={{ font: "inherit", fontWeight: 400, fontSize: 15, padding: "12px 14px", border: "1.5px solid #C9D3E3", borderRadius: 4, background: "#F6F8FB", color: "#111418" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#3A4250" }}>
                  <span style={{ display: "flex", justifyContent: "space-between" }}><span>Şifre</span>
                    <button type="button" onClick={handleReset} disabled={resetting} style={{ border: 0, background: "transparent", fontWeight: 500, color: "#005CFF", cursor: "pointer", fontSize: 13, padding: 0 }}>{resetting ? "Gönderiliyor…" : "Şifremi unuttum"}</button>
                  </span>
                  <span style={{ display: "flex", position: "relative" }}>
                    <input className="lp-input" type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ flex: 1, minWidth: 0, font: "inherit", fontWeight: 400, fontSize: 15, padding: "12px 70px 12px 14px", border: "1.5px solid #C9D3E3", borderRadius: 4, background: "#F6F8FB", color: "#111418" }} />
                    <button type="button" onClick={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", fontFamily: MONO, fontSize: 11, color: "#0042B8", cursor: "pointer", padding: "6px 8px" }}>{showPw ? "GİZLE" : "GÖSTER"}</button>
                  </span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#3A4250", cursor: "pointer" }}>
                  <input type="checkbox" style={{ accentColor: "#005CFF", width: 16, height: 16, margin: 0 }} />Beni hatırla
                </label>
                <button type="submit" disabled={loading} className="lp-btn lp-primary" style={{ padding: 14, background: "#005CFF", color: "#fff", border: 0, borderRadius: 4, fontFamily: HEAD, fontWeight: 600, fontSize: 17, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>{loading ? "Giriş yapılıyor…" : "Giriş yap"}</button>
                {error && <div style={{ fontFamily: MONO, fontSize: 12, color: "#B23A2E", background: "#FBEAE8", padding: "10px 12px", borderRadius: 4 }}>{error}</div>}
                {notice && <div style={{ fontFamily: MONO, fontSize: 12, color: "#0042B8", background: "#EAF1FF", padding: "10px 12px", borderRadius: 4 }}>{notice}</div>}
              </div>
              <div style={{ borderTop: "1px solid #DCE3EE", padding: "14px 28px", fontSize: 14, color: "#5A6474", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span>Hesabınız yok mu?</span><a href="#paketler" style={{ fontWeight: 600 }}>Paket seçin →</a>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section id="ozellikler" style={{ background: "#fff", borderBottom: "1px solid #DCE3EE" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "104px 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 72 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#5A6474" }}>§ 01 — BUGÜNKÜ SÜREÇ</span>
            <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(32px,4vw,46px)", lineHeight: 1.05 }}>Word, Excel ve dağınık klasörlerle hazırlanan dosyalar</h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                "Her firmada farklı, standart dışı çıktı; elle kopyala-yapıştır.",
                "Belge geçerlilik tarihleri elle takip ediliyor; süresi geçmiş belgeyle dosya hazırlama riski yüksek.",
                "Farklı bilgisayar ve klasörlerde saklanan belgeler; denetimde ve devir-teslimde bilgi kaybı.",
                "Tekrarlayan veri girişi, insan hatası ve onay gecikmeleri.",
              ].map((t, i, arr) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, padding: "18px 0", borderTop: "1px solid #DCE3EE", borderBottom: i === arr.length - 1 ? "1px solid #DCE3EE" : undefined }}>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: "#B23A2E" }}>✕</span>
                  <span style={{ fontSize: 16, lineHeight: 1.5, color: "#3A4250" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#005CFF" }}>§ 02 — DOSYALIFT İLE</span>
            <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(32px,4vw,46px)", lineHeight: 1.05 }}>Bir kez tanımlayın, her projede otomatik kullanın</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", border: "1.5px solid #111418" }}>
              {[
                ["A", "Standartlaştırma", "Her dosya aynı, mevzuata uygun formatta üretilir."],
                ["B", "Hız", "Saatler süren iş, veri girişi ve belge yükleme ile dakikalara iner."],
                ["C", "Güvenilirlik", "Belge geçerlilikleri izlenir; süresi dolan/dolacak belgeler için uyarı verilir."],
                ["D", "İzlenebilirlik", "Tüm belgeler, projeler ve onaylar tek yerde; rol bazlı erişimle."],
              ].map(([k, t, d], i) => (
                <div key={k} style={{ padding: 24, borderRight: i % 2 === 0 ? "1px solid #DCE3EE" : undefined, borderBottom: i < 2 ? "1px solid #DCE3EE" : undefined, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: "#005CFF" }}>{k}</span>
                  <b style={{ fontFamily: HEAD, fontSize: 21, fontWeight: 600 }}>{t}</b>
                  <span style={{ fontSize: 15, lineHeight: 1.5, color: "#3A4250" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section id="nasil" style={{ position: "relative", background: "#0A1F4D", color: "#fff", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)", backgroundSize: "120px 120px,120px 120px,24px 24px,24px 24px" }} />
        <div style={{ position: "relative", maxWidth: 1240, margin: "0 auto", padding: "104px 28px", display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 32, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "#8FB4FF" }}>§ 03 — AKIŞ ŞEMASI</span>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(34px,4.4vw,52px)", lineHeight: 1.02 }}>Beş adımda imzaya hazır teknik dosya</h2>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#8FB4FF", border: "1px solid rgba(143,180,255,0.5)", padding: "8px 12px" }}>ÇIKTI: CE TEKNİK DOSYASI · PDF</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", borderTop: "1.5px solid #8FB4FF" }}>
            {[
              ["01", "Tanımlama", "Firma bilgileri, yetkili mühendisler, onaylanmış kuruluşlar ve güvenlik ekipmanı sertifikaları sisteme bir kez girilir."],
              ["02", "Proje oluşturma", "Yeni asansör projesi için temel bilgiler girilir, mimari/ölçü/elektrik gibi belgeler yüklenir."],
              ["03", "Otomatik derleme", "Sistem, ilgili belge ve sertifikaları projeyle ilişkilendirerek teknik dosyayı derler."],
              ["04", "Üretim ve onay", "İmzaya hazır PDF çıktısı üretilir; proje onay ve takip akışları yürütülür."],
              ["05", "Takip", "Belge geçerlilikleri, proje durumu ve muhasebe kayıtları aynı ekranlardan izlenir."],
            ].map(([n, t, d], i, arr) => (
              <div key={n} style={{ padding: "28px 24px 8px 0", display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                <span style={{ position: "absolute", top: -7, left: 0, width: 12, height: 12, background: i === arr.length - 1 ? "#fff" : "#005CFF", border: i === arr.length - 1 ? "2px solid #005CFF" : "2px solid #fff", borderRadius: "50%" }} />
                <span style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 44, color: "#4D8BFF", lineHeight: 1 }}>{n}</span>
                <b style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 600 }}>{t}</b>
                <span style={{ fontSize: 15, lineHeight: 1.55, color: "#C6D6F5" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modüller */}
      <section id="moduller" style={{ background: "#F6F8FB", borderBottom: "1px solid #DCE3EE" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "104px 28px", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#5A6474" }}>§ 04 — MODÜL LİSTESİ</span>
            <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(34px,4.4vw,52px)", lineHeight: 1.02 }}>Belge, mühendis, sertifika, proje ve muhasebe tek platformda</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", border: "2px solid #111418", gap: 1, backgroundColor: "#C9D3E3" }}>
            {MODULES.map((m) => (
              <div key={m.code} className="lp-mod" style={{ background: "#fff", padding: "26px 24px", display: "flex", flexDirection: "column", gap: 10, minHeight: 170 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: "#005CFF" }}>{m.code}</span>
                <b style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{m.title}</b>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: "#3A4250" }}>{m.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 20 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "start", padding: 24, border: "1.5px solid #C9D3E3", background: "#fff", borderRadius: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#fff", background: "#111418", padding: "4px 8px" }}>KİMİN İÇİN</span>
              <span style={{ fontSize: 15, lineHeight: 1.55, color: "#3A4250" }}>Asansör montaj ve imalat firmaları; asansör bakım ve revizyon firmaları.</span>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "start", padding: 24, border: "1.5px solid #C9D3E3", background: "#fff", borderRadius: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#fff", background: "#005CFF", padding: "4px 8px" }}>ROLLER</span>
              <span style={{ fontSize: 15, lineHeight: 1.55, color: "#3A4250" }}>Firma yöneticisi, teknik personel ve yetkili mühendisler, muhasebe/finans, müşteri.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Paketler */}
      <section id="paketler" style={{ background: "#fff", borderBottom: "1px solid #DCE3EE" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "104px 28px", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 32, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "#5A6474" }}>§ 05 — PAKETLER</span>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(34px,4.4vw,52px)", lineHeight: 1.02 }}>Firmanızın hacmine göre abonelik</h2>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "#3A4250" }}>Kullanıcı sayısı, üretilen dosya hacmi ve modüllere göre katmanlı paketler.</p>
            </div>
            <div role="group" style={{ display: "flex", border: "1.5px solid #111418", borderRadius: 4, padding: 3, gap: 3, background: "#fff" }}>
              <button type="button" onClick={() => setYearly(false)} style={{ border: 0, cursor: "pointer", padding: "10px 18px", borderRadius: 2, fontFamily: HEAD, fontWeight: 600, fontSize: 15, background: yearly ? "transparent" : "#111418", color: yearly ? "#111418" : "#fff" }}>Aylık</button>
              <button type="button" onClick={() => setYearly(true)} style={{ border: 0, cursor: "pointer", padding: "10px 18px", borderRadius: 2, fontFamily: HEAD, fontWeight: 600, fontSize: 15, background: yearly ? "#111418" : "transparent", color: yearly ? "#fff" : "#111418" }}>Yıllık <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.85 }}>−%20</span></button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 24, alignItems: "stretch" }}>
            {/* Başlangıç */}
            <div style={{ border: "1.5px solid #C9D3E3", borderRadius: 4, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 24, background: "#fff" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontFamily: MONO, fontSize: 12, color: "#5A6474" }}>PKT-01</span><b style={{ fontFamily: HEAD, fontSize: 26, fontWeight: 700 }}>Başlangıç</b><span style={{ fontSize: 15, color: "#5A6474" }}>Düzenli dosya üreten küçük ekipler için.</span></div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 46, lineHeight: 1 }}>₺{p1}</span><span style={{ fontSize: 14, color: "#5A6474" }}>/ ay</span></div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#5A6474", marginTop: -16 }}>{billNote}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15, color: "#3A4250", borderTop: "1px solid #DCE3EE", paddingTop: 20, flex: 1 }}>
                {["2 kullanıcı", "Ayda 10 teknik dosya", "Teknik dosya üretimi ve PDF çıktısı", "Firma ve belge yönetimi", "Geçerlilik bildirimleri"].map((x) => <span key={x}>— {x}</span>)}
              </div>
              <a className="lp-btn lp-outline" href="#demo" style={{ textAlign: "center", padding: 14, border: "1.5px solid #111418", color: "#111418", borderRadius: 4, fontFamily: HEAD, fontWeight: 600, fontSize: 16 }}>Başla</a>
            </div>

            {/* Profesyonel */}
            <div style={{ border: "2px solid #005CFF", borderRadius: 4, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 24, background: "#005CFF", color: "#fff", boxShadow: "8px 8px 0 #111418", position: "relative" }}>
              <span style={{ position: "absolute", top: -13, right: 20, background: "#111418", color: "#fff", fontFamily: MONO, fontSize: 11, padding: "5px 10px" }}>EN ÇOK TERCİH EDİLEN</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontFamily: MONO, fontSize: 12, color: "#CFE0FF" }}>PKT-02</span><b style={{ fontFamily: HEAD, fontSize: 26, fontWeight: 700 }}>Profesyonel</b><span style={{ fontSize: 15, color: "#E0EBFF" }}>Birden fazla mühendis ve projeyle çalışan firmalar için.</span></div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 46, lineHeight: 1 }}>₺{p2}</span><span style={{ fontSize: 14, color: "#E0EBFF" }}>/ ay</span></div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#E0EBFF", marginTop: -16 }}>{billNote}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15, color: "#fff", borderTop: "1px solid rgba(255,255,255,0.35)", paddingTop: 20, flex: 1 }}>
                {["5 kullanıcı", "Ayda 50 teknik dosya", "Başlangıç paketindeki her şey", "Yetkili mühendisler", "Güvenlik ekipmanları ve sertifikalar", "Proje takip", "Rol bazlı erişim"].map((x) => <span key={x}>— {x}</span>)}
              </div>
              <a className="lp-btn lp-white" href="#demo" style={{ textAlign: "center", padding: 14, background: "#fff", color: "#005CFF", borderRadius: 4, fontFamily: HEAD, fontWeight: 600, fontSize: 16 }}>Profesyonel&apos;i seç</a>
            </div>

            {/* Kurumsal */}
            <div style={{ border: "1.5px solid #111418", borderRadius: 4, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 24, background: "#111418", color: "#fff" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontFamily: MONO, fontSize: 12, color: "#8FB4FF" }}>PKT-03</span><b style={{ fontFamily: HEAD, fontSize: 26, fontWeight: 700 }}>Kurumsal</b><span style={{ fontSize: 15, color: "#B9C2D0" }}>Yüksek hacim, ek modül ve entegrasyon ihtiyacı için.</span></div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 46, lineHeight: 1 }}>Teklif</span></div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#B9C2D0", marginTop: -16 }}>İhtiyaca göre fiyatlandırılır</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15, color: "#E4E8EE", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 20, flex: 1 }}>
                {["Sınırsız kullanıcı ve dosya", "Profesyonel paketteki her şey", "Muhasebe modülü", "Kurulum, onboarding ve veri taşıma", "Ek modüller ve entegrasyonlar"].map((x) => <span key={x}>— {x}</span>)}
              </div>
              <a className="lp-btn lp-white" href="#demo" style={{ textAlign: "center", padding: 14, border: "1.5px solid #fff", color: "#fff", borderRadius: 4, fontFamily: HEAD, fontWeight: 600, fontSize: 16 }}>Bize ulaşın</a>
            </div>
          </div>
        </div>
      </section>

      {/* Demo / İletişim */}
      <section id="demo" style={{ background: "#F6F8FB" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "104px 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 48, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#5A6474" }}>§ 06 — SONRAKİ ADIM</span>
            <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: "clamp(34px,4.4vw,52px)", lineHeight: 1.02 }}>Detaylı demo ve canlı ürün gösterimi</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "#3A4250", maxWidth: 520 }}>Demo, canlı ürün gösterimi ve iş birliği görüşmeleri için iletişime geçebilirsiniz.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", border: "2px solid #111418", background: "#fff", fontSize: 15 }}>
            {[["İLGİLİ KİŞİ", "[Ad Soyad]"], ["E-POSTA", "[e-posta]"], ["TELEFON", "[telefon]"], ["WEB", "dosyalift.com"]].map(([k, v], i) => (
              <div key={k} style={{ display: "contents" }}>
                <span style={{ padding: "16px 20px", borderRight: "1px solid #DCE3EE", borderBottom: "1px solid #DCE3EE", fontFamily: MONO, fontSize: 12, color: "#5A6474" }}>{k}</span>
                <span style={{ padding: "16px 20px", borderBottom: "1px solid #DCE3EE" }}>{v}</span>
              </div>
            ))}
            <a className="lp-btn lp-primary" href="mailto:" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 16, background: "#005CFF", color: "#fff", fontFamily: HEAD, fontWeight: 600, fontSize: 17 }}>Demo talep et</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#111418", color: "#B9C2D0" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-app.png" alt="Dosyalift" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><b style={{ fontFamily: HEAD, color: "#fff", fontSize: 18, letterSpacing: "0.06em" }}>DOSYALIFT</b><span style={{ fontSize: 13 }}>Asansör CE Teknik Dosya Platformu</span></div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14, alignItems: "center" }}>
            <a href="#ozellikler" style={{ color: "#B9C2D0" }}>Özellikler</a>
            <a href="#paketler" style={{ color: "#B9C2D0" }}>Paketler</a>
            <a href="#giris" style={{ color: "#B9C2D0" }}>Giriş yap</a>
            <span style={{ fontFamily: MONO, fontSize: 12 }}>© 2026 Dosyalift</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
