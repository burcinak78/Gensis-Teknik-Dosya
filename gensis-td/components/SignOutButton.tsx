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
      className="text-xs text-slate-300 hover:text-white underline"
    >
      Çıkış yap
    </button>
  );
}
