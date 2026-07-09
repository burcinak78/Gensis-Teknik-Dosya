"use client";

import { useMemo, useState } from "react";

export type CertItem = { id: string; cert_no: string; models: string[] };
export type CertGroup = { key: string; name: string; certs: CertItem[] };

export default function SertifikaClient({ groups }: { groups: CertGroup[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const s = q.trim().toLocaleLowerCase("tr");
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

  const filtered = useMemo(() => {
    if (!s) return groups;
    return groups
      .map((g) => ({ ...g, certs: g.certs.filter((c) => c.cert_no.toLocaleLowerCase("tr").includes(s) || c.models.join(" ").toLocaleLowerCase("tr").includes(s)) }))
      .filter((g) => g.certs.length > 0);
  }, [s, groups]);

  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
      <div className="p-3 border-b border-slate-100">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sertifika no veya model ara…" className={inp} />
      </div>
      <div>
        {filtered.map((g) => {
          const isOpen = open.has(g.key) || !!s;
          return (
            <div key={g.key} className="border-b border-slate-100 last:border-0">
              <button onClick={() => toggle(g.key)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <span className="font-semibold text-sm">{g.name}</span>
                <span className="text-xs text-slate-400">{g.certs.length} sertifika {isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="pb-2">
                  {g.certs.map((c) => (
                    <div key={c.id} className="px-5 py-1.5 pl-8 border-l-2 border-slate-100 ml-5">
                      <div className="text-sm font-semibold">{c.cert_no}</div>
                      {c.models.length > 0 && <div className="text-xs text-slate-500">{c.models.join(", ")}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="px-5 py-4 text-sm text-slate-400">Sonuç yok.</div>}
      </div>
    </div>
  );
}
