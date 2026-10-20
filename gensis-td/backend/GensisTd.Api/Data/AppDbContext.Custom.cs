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

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        var b = modelBuilder;

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
