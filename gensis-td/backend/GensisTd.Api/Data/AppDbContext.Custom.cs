using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace GensisTd.Api.Data;

// Hand-written model configuration; AppDbContext.cs is scaffolded and gets overwritten.
public partial class AppDbContext
{
    public static void MapEnums(Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure.NpgsqlDbContextOptionsBuilder o) => o
        .MapEnum<AppRole>("app_role")
        .MapEnum<EngineerDiscipline>("engineer_discipline")
        .MapEnum<FieldSource>("field_source")
        .MapEnum<FieldTransform>("field_transform")
        .MapEnum<GeneratedKind>("generated_kind")
        .MapEnum<ModuleType>("module_type")
        .MapEnum<ProjectStatus>("project_status")
        .MapEnum<SubscriptionStatus>("subscription_status")
        .MapEnum<TemplateFormat>("template_format");

    public virtual DbSet<PendingChange> PendingChanges { get; set; }

    public virtual DbSet<TdCounter> TdCounters { get; set; }

    public virtual DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

    public virtual DbSet<LibraryDocument> LibraryDocuments { get; set; }

    public virtual DbSet<ProjectDocumentChoice> ProjectDocumentChoices { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        var b = modelBuilder;

        b.Entity<TdCounter>(e =>
        {
            e.ToTable("td_counters");
            e.HasKey(x => x.Year).HasName("td_counters_pkey");
            e.Property(x => x.Year).HasColumnName("year").ValueGeneratedNever();
            e.Property(x => x.LastNo).HasColumnName("last_no");
        });

        b.Entity<Company>().Property(x => x.ContactMobilePhone).HasColumnName("contact_mobile_phone");

        b.Entity<User>().Property(x => x.TokenVersion).HasColumnName("token_version").HasDefaultValueSql("0");

        b.Entity<LibraryDocument>(e =>
        {
            e.ToTable("document_library", t =>
            {
                t.HasCheckConstraint("document_library_doc_type_check",
                    "doc_type IN ('bakim_sozlesmesi','son_kontrol_formu','kullanma_bakim_klavuzu','seyir_defteri','egitim_tutanagi','teslim_tutanagi')");
                t.HasCheckConstraint("document_library_archived_not_default_check", "NOT (is_default AND archived_at IS NOT NULL)");
            });
            e.HasKey(x => x.Id).HasName("document_library_pkey");
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.DocType).HasColumnName("doc_type");
            e.Property(x => x.StoragePath).HasColumnName("storage_path");
            e.Property(x => x.OriginalName).HasColumnName("original_name");
            e.Property(x => x.SizeBytes).HasColumnName("size_bytes");
            e.Property(x => x.IsDefault).HasColumnName("is_default");
            e.Property(x => x.ArchivedAt).HasColumnName("archived_at");
            e.Property(x => x.ArchivedBy).HasColumnName("archived_by");
            e.Property(x => x.UploadedBy).HasColumnName("uploaded_by");
            e.Property(x => x.UploadedAt).HasColumnName("uploaded_at");
            e.HasIndex(x => x.StoragePath, "document_library_storage_path_key").IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.DocType }, "idx_document_library_company_type");
            e.HasIndex(x => new { x.CompanyId, x.DocType }, "document_library_one_default_key").IsUnique()
                .HasFilter("is_default AND archived_at IS NULL");
            e.HasOne(x => x.Company).WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("document_library_company_id_fkey");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UploadedBy).OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("document_library_uploaded_by_fkey");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.ArchivedBy).OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("document_library_archived_by_fkey");
        });

        b.Entity<ProjectDocumentChoice>(e =>
        {
            e.ToTable("project_document_choices");
            e.HasKey(x => new { x.ProjectId, x.DocType }).HasName("project_document_choices_pkey");
            e.Property(x => x.ProjectId).HasColumnName("project_id");
            e.Property(x => x.DocType).HasColumnName("doc_type");
            e.Property(x => x.LibraryDocumentId).HasColumnName("library_document_id");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => x.LibraryDocumentId, "idx_project_document_choices_document");
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("project_document_choices_project_id_fkey");
            e.HasOne(x => x.LibraryDocument).WithMany().HasForeignKey(x => x.LibraryDocumentId).OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("project_document_choices_library_document_id_fkey");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UpdatedBy).OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("project_document_choices_updated_by_fkey");
        });

        b.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("password_reset_tokens");
            e.HasKey(x => x.Id).HasName("password_reset_tokens_pkey");
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.TokenHash).HasColumnName("token_hash");
            e.Property(x => x.TokenVersion).HasColumnName("token_version");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.UsedAt).HasColumnName("used_at");
            e.HasIndex(x => x.TokenHash, "password_reset_tokens_token_hash_key").IsUnique();
            e.HasIndex(x => x.UserId, "idx_password_reset_tokens_user");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("password_reset_tokens_user_id_fkey");
        });

        b.Entity<PendingChange>(e =>
        {
            e.ToTable("pending_changes", t =>
            {
                t.HasCheckConstraint("pending_changes_kind_check", $"kind IN ({SqlList(PendingChange.Kinds)})");
                t.HasCheckConstraint("pending_changes_status_check", $"status IN ({SqlList(PendingChange.Statuses)})");
            });
            e.HasKey(x => x.Id).HasName("pending_changes_pkey");
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Kind).HasColumnName("kind");
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.TargetId).HasColumnName("target_id");
            e.Property(x => x.EngineerId).HasColumnName("engineer_id");
            e.Property(x => x.DocType).HasColumnName("doc_type");
            e.Property(x => x.Payload).HasColumnName("payload").HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
            e.Property(x => x.StoragePath).HasColumnName("storage_path");
            e.Property(x => x.OriginalName).HasColumnName("original_name");
            e.Property(x => x.Status).HasColumnName("status").HasDefaultValueSql("'pending'");
            e.Property(x => x.Note).HasColumnName("note");
            e.Property(x => x.SubmittedBy).HasColumnName("submitted_by");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at").HasDefaultValueSql("now()");
            e.Property(x => x.ReviewedBy).HasColumnName("reviewed_by");
            e.Property(x => x.ReviewedAt).HasColumnName("reviewed_at");
            e.HasIndex(x => x.Status, "idx_pending_changes_status");
            e.HasIndex(x => x.CompanyId, "idx_pending_changes_company");
            e.HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("pending_changes_company_id_fkey");
            e.HasOne<Engineer>().WithMany().HasForeignKey(x => x.EngineerId).OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("pending_changes_engineer_id_fkey");
            e.HasOne<Profile>().WithMany().HasForeignKey(x => x.SubmittedBy).OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("pending_changes_submitted_by_fkey");
            e.HasOne<Profile>().WithMany().HasForeignKey(x => x.ReviewedBy).OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("pending_changes_reviewed_by_fkey");
        });

        // Enum columns skipped by the scaffolder.
        b.Entity<CompanyModuleCert>(e =>
        {
            e.Property(x => x.ModuleType).HasColumnName("module_type");
            e.HasIndex(x => new { x.CompanyId, x.ModuleType }, "company_module_certs_company_id_module_type_key").IsUnique();
        });
        b.Entity<DocumentTemplate>().Property(x => x.Format).HasColumnName("format");
        b.Entity<Engineer>().Property(x => x.Discipline).HasColumnName("discipline");
        b.Entity<GeneratedFile>().Property(x => x.Kind).HasColumnName("kind");
        b.Entity<Profile>().Property(x => x.Role).HasColumnName("role");
        b.Entity<Project>(e =>
        {
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.CertificationModule).HasColumnName("certification_module");
            e.HasIndex(x => x.Status, "idx_projects_status");
        });
        b.Entity<Subscription>().Property(x => x.Status).HasColumnName("status");
        b.Entity<TemplateField>(e =>
        {
            e.Property(x => x.Source).HasColumnName("source");
            e.Property(x => x.Transform).HasColumnName("transform");
        });
        b.Entity<VProjectOverview>().Property(x => x.Status).HasColumnName("status");

        // See EntityDefaults.cs: constant defaults on non-nullable value types live in the constructors.
        foreach (var property in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
        {
            if (property.ClrType.IsValueType && Nullable.GetUnderlyingType(property.ClrType) is null
                && property.GetDefaultValue() is not null)
            {
                property.SetDefaultValue(null);
                property.RemoveAnnotation(RelationalAnnotationNames.DefaultValue);
            }
        }
    }

    private static string SqlList(IEnumerable<string> values) => string.Join(", ", values.Select(v => $"'{v}'"));
}
