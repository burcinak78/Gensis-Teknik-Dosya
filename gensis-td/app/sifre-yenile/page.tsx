"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SifreYenilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // E-posta bağlantısından gelen kurtarma oturumunu yakala
  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };

    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(); });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) finish();
    });

    // PKCE akışı: ?code=... varsa oturuma çevir
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => { if (error) setError("Bağlantı doğrulanamadı: " + error.message); else finish(); });
    }

    // Bir süre içinde oturum bulunamazsa uyar
    const t = setTimeout(() => {
      if (!done) setError("Geçerli bir sıfırlama oturumu bulunamadı. Lütfen giriş ekranından 'Sıfırla' ile yeni bağlantı isteyin.");
    }, 4000);

    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    if (pw.length < 6) return setError("Şifre en az 6 karakter olmalı.");
    if (pw !== pw2) return setError("Şifreler eşleşmiyor.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError("Şifre güncellenemedi: " + error.message);
    setNotice("Şifreniz güncellendi. Giriş ekranına yönlendiriliyorsunuz…");
    setTimeout(() => { router.push("/giris"); router.refresh(); }, 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f5f6fa]">
      <form onSubmit={submit} className="w-full max-w-[380px]">
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GENSIS" style={{ height: 32, width: "auto" }} />
        </div>
        <h2 className="text-[24px] font-extrabold tracking-tight">Yeni şifre belirle</h2>
        <p className="text-sm text-slate-500 mb-6">Hesabınız için yeni bir şifre girin.</p>

        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Yeni Şifre</label>
        <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="En az 6 karakter"
          className="w-full mb-4 px-3 py-3 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-2 focus:ring-[#eef1f8]" />

        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Yeni Şifre (Tekrar)</label>
        <input type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Tekrar giriniz"
          className="w-full mb-5 px-3 py-3 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-2 focus:ring-[#eef1f8]" />

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        {notice && <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</div>}

        <button type="submit" disabled={busy || !ready} className="gs-btn w-full font-bold py-3 rounded-xl disabled:opacity-50">
          {busy ? "Güncelleniyor…" : "Şifreyi Güncelle"}
        </button>
        <p className="text-center text-xs text-slate-400 mt-4">
          <a href="/giris" className="text-navy font-semibold hover:underline">← Giriş ekranına dön</a>
        </p>
      </form>
    </div>
  );
}
