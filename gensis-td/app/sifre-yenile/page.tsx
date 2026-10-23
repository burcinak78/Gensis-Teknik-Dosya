"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Same screen as live. The e-mail link carries the token after "#", which the browser never sends to a server;
// it is read once and removed from the address bar.
const MIN_LENGTH = 10; // user decision (KRR-024); live asked for 6

export default function SifreYenilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (t) {
      setToken(t);
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      setError("Geçerli bir sıfırlama oturumu bulunamadı. Lütfen giriş ekranından 'Sıfırla' ile yeni bağlantı isteyin.");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    if (pw.length < MIN_LENGTH) return setError(`Şifre en az ${MIN_LENGTH} karakter olmalı.`);
    if (pw !== pw2) return setError("Şifreler eşleşmiyor.");
    setBusy(true);
    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: pw }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setError("Şifre güncellenemedi: sunucuya ulaşılamadı.");
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const first = body?.errors && (Object.values(body.errors) as string[][]).flat()[0];
      return setError("Şifre güncellenemedi: " + (first ?? "beklenmeyen bir hata oluştu."));
    }
    setToken(null);
    setNotice("Şifreniz güncellendi. Giriş ekranına yönlendiriliyorsunuz…");
    setTimeout(() => { router.push("/giris"); router.refresh(); }, 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f5f6fa]">
      <form onSubmit={submit} className="w-full max-w-[380px]">
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dosyalift" style={{ height: 44, width: "auto" }} />
        </div>
        <h2 className="text-[24px] font-extrabold tracking-tight">Yeni şifre belirle</h2>
        <p className="text-sm text-slate-500 mb-6">Hesabınız için yeni bir şifre girin.</p>

        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Yeni Şifre</label>
        <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder={`En az ${MIN_LENGTH} karakter`}
          autoComplete="new-password"
          className="w-full mb-4 px-3 py-3 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-2 focus:ring-[#eef1f8]" />

        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Yeni Şifre (Tekrar)</label>
        <input type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Tekrar giriniz"
          autoComplete="new-password"
          className="w-full mb-5 px-3 py-3 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-2 focus:ring-[#eef1f8]" />

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        {notice && <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</div>}

        <button type="submit" disabled={busy || !token} className="gs-btn w-full font-bold py-3 rounded-xl disabled:opacity-50">
          {busy ? "Güncelleniyor…" : "Şifreyi Güncelle"}
        </button>
        <p className="text-center text-xs text-slate-400 mt-4">
          <a href="/giris" className="text-navy font-semibold hover:underline">← Giriş ekranına dön</a>
        </p>
      </form>
    </div>
  );
}
