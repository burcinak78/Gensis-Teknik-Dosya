"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEngineer } from "../actions";

export default function DeleteEngineerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`"${name}" mühendisini silmek istiyor musunuz?`)) return;
    setBusy(true);
    const res = await deleteEngineer(id);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <button onClick={onDelete} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
      {busy ? "…" : "Sil"}
    </button>
  );
}
