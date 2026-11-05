namespace GensisTd.Api.Data.Entities;

/// <summary>A PDF kept for a company, usable in place of a generated teknik dosya document (z8qgvcc134).</summary>
public class LibraryDocument
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string DocType { get; set; } = null!;
    public string StoragePath { get; set; } = null!;
    public string OriginalName { get; set; } = null!;
    public long SizeBytes { get; set; }
    public bool IsDefault { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public Guid? ArchivedBy { get; set; }
    public Guid? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }

    public virtual Company Company { get; set; } = null!;
}

/// <summary>The library document one project uses for one document type. No row means the system generates it.</summary>
public class ProjectDocumentChoice
{
    public Guid ProjectId { get; set; }
    public string DocType { get; set; } = null!;
    public Guid LibraryDocumentId { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; }

    public virtual LibraryDocument LibraryDocument { get; set; } = null!;
}
