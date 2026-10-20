namespace GensisTd.Api.Data.Entities;

/// <summary>
/// A customer's change waiting for staff approval (company/engineer edits, new engineer, documents).
/// The Next.js code used this table but it never existed in Supabase (db/08 missing); columns are
/// taken from that code. Code-first: not part of the scaffolded Supabase schema.
/// </summary>
public class PendingChange
{
    public static readonly string[] Kinds = ["company_edit", "engineer_new", "engineer_edit", "company_doc", "engineer_doc"];
    public static readonly string[] Statuses = ["pending", "approved", "rejected"];

    public Guid Id { get; set; }
    public string Kind { get; set; } = "";
    public Guid? CompanyId { get; set; }
    public Guid? TargetId { get; set; }
    public Guid? EngineerId { get; set; }
    public string? DocType { get; set; }
    public string Payload { get; set; } = "{}";
    public string? StoragePath { get; set; }
    public string? OriginalName { get; set; }
    public string Status { get; set; } = "pending";
    public string? Note { get; set; }
    public Guid? SubmittedBy { get; set; }
    public DateTime SubmittedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
}
