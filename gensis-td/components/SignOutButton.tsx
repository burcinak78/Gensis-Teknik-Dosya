"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/giris");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      title="Çıkış yap"
      aria-label="Çıkış yap"
      className="flex-none w-8 h-8 grid place-items-center rounded-lg text-[#94a3b8] hover:text-navy hover:bg-white"
    >
      <span className="material-symbols-rounded text-[20px]">logout</span>
    </button>
  );
}
