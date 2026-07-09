"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
      >
        <div className="mb-6">
          <Logo height={36} />
          <div className="text-xs text-slate-500 mt-2">
            Teknik Dosya · Hesabına giriş yap
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-700 mb-1">
          E-posta
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-brand"
          placeholder="ornek@firma.com"
        />

        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Şifre
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-5 px-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-brand"
          placeholder="••••••••"
        />

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
