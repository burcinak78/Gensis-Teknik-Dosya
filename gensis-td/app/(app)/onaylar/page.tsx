import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OnaylarClient from "./OnaylarClient";

export const dynamic = "force-dynamic";

export default async function OnaylarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const staff = prof?.role === "admin" || prof?.role === "gensis";
  if (!staff) redirect("/panel");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("pending_changes")
    .select("id, kind, company_id, target_id, engineer_id, doc_type, payload, storage_path, original_name, status, submitted_by, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });
  const list = (rows ?? []) as any[];

  const companyIds = Array.from(new Set(list.map((r) => r.company_id).filter(Boolean)));
  const engineerIds = Array.from(new Set(list.map((r) => r.engineer_id).filter(Boolean)));
  const submitterIds = Array.from(new Set(list.map((r) => r.submitted_by).filter(Boolean)));

  const [companiesRes, engineersRes, profilesRes] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, short_name").in("id", companyIds) : Promise.resolve({ data: [] as any[] }),
    engineerIds.length ? admin.from("engineers").select("id, full_name").in("id", engineerIds) : Promise.resolve({ data: [] as any[] }),
    submitterIds.length ? admin.from("profiles").select("id, full_name").in("id", submitterIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const compMap = Object.fromEntries((companiesRes.data ?? []).map((c: any) => [c.id, c.short_name]));
  const engMap = Object.fromEntries((engineersRes.data ?? []).map((e: any) => [e.id, e.full_name]));
  const profMap = Object.fromEntries((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name]));

  const items = await Promise.all(
    list.map(async (r) => {
      let fileUrl: string | null = null;
      if (r.storage_path) {
        const { data: signed } = await admin.storage.from("documents").createSignedUrl(r.storage_path, 60 * 30);
        fileUrl = signed?.signedUrl ?? null;
      }
      return {
        id: r.id as string,
        kind: r.kind as string,
        docType: (r.doc_type ?? null) as string | null,
        payload: (r.payload ?? {}) as Record<string, any>,
        companyName: r.company_id ? (compMap[r.company_id] ?? "—") : "—",
        engineerName: r.engineer_id ? (engMap[r.engineer_id] ?? "—") : ((r.payload?.full_name as string) ?? null),
        submitter: r.submitted_by ? (profMap[r.submitted_by] ?? "—") : "—",
        submittedAt: r.submitted_at as string,
        originalName: (r.original_name ?? null) as string | null,
        fileUrl,
        isUpdate: !!r.target_id,
      };
    })
  );

  return <OnaylarClient items={items} />;
}
