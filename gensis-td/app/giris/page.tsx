"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function GirisPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Giriş başarısız: " + error.message);
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Sol hero panel */}
      <div className="gs-hero relative overflow-hidden hidden lg:flex flex-col justify-between p-14">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute bottom-10 -left-16 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative z-10 bg-white rounded-2xl px-5 py-3 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GENSIS" style={{ height: 34, width: "auto" }} />
        </div>
        <div className="relative z-10">
          <h1 className="text-[40px] leading-tight font-extrabold max-w-[15ch]">
            Teknik dosyanız dakikalar içinde, kusursuz.
          </h1>
          <p className="mt-4 text-white/80 max-w-md">
            Asansör CE teknik dosyalarını uçtan uca üreten kurumsal platform. Veri girişinden
            imzalı PDF'e tek akışta.
          </p>
        </div>
        <div className="relative z-10 flex gap-10">
          {[
            ["1.240+", "Üretilen dosya"],
            ["18", "Onaylı kuruluş"],
            ["%99,4", "İlk onay oranı"],
          ].map(([v, l]) => (
            <div key={l}>
              <div className="text-2xl font-extrabold">{v}</div>
              <div className="text-xs text-white/70">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ form paneli */}
      <div className="flex items-center justify-center p-6 bg-[#f5f6fa]">
        <form onSubmit={handleLogin} className="w-full max-w-[380px]">
          <div className="lg:hidden mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GENSIS" style={{ height: 32, width: "auto" }} />
          </div>
          <h2 className="text-[24px] font-extrabold tracking-tight">Hesabına giriş yap</h2>
          <p className="text-sm text-slate-500 mb-6">Teknik dosya platformuna erişmek için oturum aç.</p>

          <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-posta</label>
          <div className="relative mb-4">
            <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">mail</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@firma.com"
              className="w-full pl-11 pr-3 py-3 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-2 focus:ring-[#eef1f8]"
            />
          </div>

          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Şifre</label>
          <div className="relative mb-5">
            <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">lock</span>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-11 pr-3 py-3 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-2 focus:ring-[#eef1f8]"
            />
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={loading} className="gs-btn w-full font-bold py-3 rounded-xl">
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
          <p className="text-center text-xs text-slate-400 mt-4">
            Şifreni mi unuttun? <span className="text-navy font-semibold">Sıfırla</span>
          </p>
        </form>
      </div>
    </div>
  );
}
