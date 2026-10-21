// E-posta bağlantısıyla şifre yenileme Supabase Auth'a bağlıydı. Yeni sistemde e-posta gönderimi
// gelene kadar şifreyi Gensis yöneticisi sıfırlar; eski bağlantılar buraya düşer.
export default function SifreYenilePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f5f6fa]">
      <div className="w-full max-w-[380px]">
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dosyalift" style={{ height: 44, width: "auto" }} />
        </div>
        <h2 className="text-[24px] font-extrabold tracking-tight">Şifre yenileme</h2>
        <p className="text-sm text-slate-500 mb-6">
          Şifrenizi sıfırlamak için Gensis yöneticinize başvurun. Yönetici yeni bir şifre belirleyip size iletecektir.
        </p>
        <p className="text-center text-xs text-slate-400 mt-4">
          <a href="/giris" className="text-navy font-semibold hover:underline">← Giriş ekranına dön</a>
        </p>
      </div>
    </div>
  );
}
