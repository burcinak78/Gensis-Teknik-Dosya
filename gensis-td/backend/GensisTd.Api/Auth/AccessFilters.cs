using GensisTd.Api.Data.Entities;

namespace GensisTd.Api.Auth;

/// <summary>
/// Read filters replacing the Supabase RLS SELECT policies (schema dump 2026-10-20).
/// Catalog tables (certificates, provinces, equipment, ...) are readable by every signed-in user
/// and need no filter. Companies, engineers and company module certs hold contact and company data,
/// so they are filtered here although Supabase let everyone read them (KRR-014).
/// Write rules are checked in the endpoints with Actor.
/// The staff/company decision is made here in C#, so a user without a company never reaches
/// a `company_id = NULL` comparison.
/// </summary>
public static class AccessFilters
{
    // p_projects_select, p_proje_onay_select, p_company_docs_read, p_subs_select, p_usage_select
    public static IQueryable<Project> VisibleTo(this IQueryable<Project> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<ProjeOnay> VisibleTo(this IQueryable<ProjeOnay> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<CompanyDocument> VisibleTo(this IQueryable<CompanyDocument> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<Subscription> VisibleTo(this IQueryable<Subscription> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<UsageRecord> VisibleTo(this IQueryable<UsageRecord> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    // No Supabase policy (table was missing there); same rule as the company's other rows.
    public static IQueryable<PendingChange> VisibleTo(this IQueryable<PendingChange> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    // p_project_equipment_all, p_project_files_all, p_generated_files_all, p_download_links_all
    public static IQueryable<ProjectEquipment> VisibleTo(this IQueryable<ProjectEquipment> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.Project.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<ProjectFile> VisibleTo(this IQueryable<ProjectFile> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.Project.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<GeneratedFile> VisibleTo(this IQueryable<GeneratedFile> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.Project.CompanyId == cid) : q.Where(_ => false);

    public static IQueryable<DownloadLink> VisibleTo(this IQueryable<DownloadLink> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.GeneratedFile.Project.CompanyId == cid) : q.Where(_ => false);

    // KRR-014: staff see every company, others only their own.
    public static IQueryable<Company> VisibleTo(this IQueryable<Company> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.Id == cid) : q.Where(_ => false);

    // Reading only: the accountant read every company on live, by design (user, 2026-10-21). Writes use VisibleTo.
    public static IQueryable<Company> ReadableBy(this IQueryable<Company> q, Actor a) =>
        a.IsOffice ? q : q.VisibleTo(a);

    public static IQueryable<CompanyModuleCert> VisibleTo(this IQueryable<CompanyModuleCert> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(x => x.CompanyId == cid) : q.Where(_ => false);

    // KRR-014: own company's engineers plus Gensis's, which the project wizard offers to every customer.
    // The accountant reads all, as on live (by design). Reading only.
    // A null Gensis id must not become `company_id IS NULL`, so it only joins the filter when known.
    public static IQueryable<Engineer> ReadableBy(this IQueryable<Engineer> q, Actor a, Guid? gensisCompanyId) =>
        a.IsOffice ? q
        : a.CompanyId is not { } cid ? q.Where(_ => false)
        : gensisCompanyId is { } gid ? q.Where(x => x.CompanyId == cid || x.CompanyId == gid)
        : q.Where(x => x.CompanyId == cid);

    // p_profiles_select: own profile, staff see all
    public static IQueryable<Profile> VisibleTo(this IQueryable<Profile> q, Actor a) =>
        a.IsStaff ? q : q.Where(x => x.Id == a.UserId);

    // notlar_*: owner only, staff included
    public static IQueryable<Notlar> OwnedBy(this IQueryable<Notlar> q, Actor a) =>
        q.Where(x => x.UserId == a.UserId);

    // p_eng_docs_read, p_audit_log_read, p_email_log_read: staff only
    public static IQueryable<EngineerDocument> VisibleTo(this IQueryable<EngineerDocument> q, Actor a) =>
        a.IsStaff ? q : q.Where(_ => false);
}
