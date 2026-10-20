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

    partial void OnModelCreatingPartial(ModelBuilder b)
    {
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
}
