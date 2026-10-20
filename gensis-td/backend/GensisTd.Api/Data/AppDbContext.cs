using System;
using System.Collections.Generic;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Data;

public partial class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<CapacityTable> CapacityTables { get; set; }

    public virtual DbSet<Certificate> Certificates { get; set; }

    public virtual DbSet<CertificateFile> CertificateFiles { get; set; }

    public virtual DbSet<Company> Companies { get; set; }

    public virtual DbSet<CompanyDocument> CompanyDocuments { get; set; }

    public virtual DbSet<CompanyModuleCert> CompanyModuleCerts { get; set; }

    public virtual DbSet<District> Districts { get; set; }

    public virtual DbSet<DocumentTemplate> DocumentTemplates { get; set; }

    public virtual DbSet<DocumentType> DocumentTypes { get; set; }

    public virtual DbSet<DownloadLink> DownloadLinks { get; set; }

    public virtual DbSet<EmailLog> EmailLogs { get; set; }

    public virtual DbSet<Engineer> Engineers { get; set; }

    public virtual DbSet<EngineerDocument> EngineerDocuments { get; set; }

    public virtual DbSet<EquipmentBrand> EquipmentBrands { get; set; }

    public virtual DbSet<EquipmentCategory> EquipmentCategories { get; set; }

    public virtual DbSet<EquipmentModel> EquipmentModels { get; set; }

    public virtual DbSet<GeneratedFile> GeneratedFiles { get; set; }

    public virtual DbSet<IlgiliIdareler> IlgiliIdarelers { get; set; }

    public virtual DbSet<LookupValue> LookupValues { get; set; }

    public virtual DbSet<NotifiedBody> NotifiedBodies { get; set; }

    public virtual DbSet<Notlar> Notlars { get; set; }

    public virtual DbSet<Plan> Plans { get; set; }

    public virtual DbSet<Profile> Profiles { get; set; }

    public virtual DbSet<ProjeOnay> ProjeOnays { get; set; }

    public virtual DbSet<Project> Projects { get; set; }

    public virtual DbSet<ProjectEquipment> ProjectEquipments { get; set; }

    public virtual DbSet<ProjectFile> ProjectFiles { get; set; }

    public virtual DbSet<Province> Provinces { get; set; }

    public virtual DbSet<Subscription> Subscriptions { get; set; }

    public virtual DbSet<TakipCounter> TakipCounters { get; set; }

    public virtual DbSet<TakipDokumanlar> TakipDokumanlars { get; set; }

    public virtual DbSet<TakipMuhasebe> TakipMuhasebes { get; set; }

    public virtual DbSet<TakipProjeler> TakipProjelers { get; set; }

    public virtual DbSet<TemplateField> TemplateFields { get; set; }

    public virtual DbSet<UsageRecord> UsageRecords { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<VEquipmentCatalog> VEquipmentCatalogs { get; set; }

    public virtual DbSet<VProjectOverview> VProjectOverviews { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresEnum("app_role", new[] { "admin", "gensis", "customer", "muhasebeci" })
            .HasPostgresEnum("engineer_discipline", new[] { "elektrik", "makine", "elektrik_elektronik", "mekatronik" })
            .HasPostgresEnum("field_source", new[] { "input", "company", "company_module", "equipment", "engineer", "capacity", "province", "district", "static", "derived" })
            .HasPostgresEnum("field_transform", new[] { "none", "upper", "lower", "title", "date_tr", "number_tr" })
            .HasPostgresEnum("generated_kind", new[] { "combined_pdf", "single_pdf", "zip" })
            .HasPostgresEnum("module_type", new[] { "B_MR", "B_MRL", "E", "H", "G" })
            .HasPostgresEnum("project_status", new[] { "draft", "generating", "generated", "delivered", "canceled" })
            .HasPostgresEnum("subscription_status", new[] { "trialing", "active", "past_due", "canceled" })
            .HasPostgresEnum("template_format", new[] { "html", "docx" });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("audit_log_pkey");

            entity.ToTable("audit_log");

            entity.HasIndex(e => new { e.ActorId, e.CreatedAt }, "idx_audit_actor");

            entity.HasIndex(e => new { e.EntityType, e.EntityId }, "idx_audit_entity");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Action).HasColumnName("action");
            entity.Property(e => e.ActorId).HasColumnName("actor_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.EntityType).HasColumnName("entity_type");
            entity.Property(e => e.Metadata)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("metadata");

            entity.HasOne(d => d.Actor).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.ActorId)
                .HasConstraintName("audit_log_actor_id_fkey");
        });

        modelBuilder.Entity<CapacityTable>(entity =>
        {
            entity.HasKey(e => e.BeyanYukuKg).HasName("capacity_table_pkey");

            entity.ToTable("capacity_table");

            entity.Property(e => e.BeyanYukuKg)
                .ValueGeneratedNever()
                .HasColumnName("beyan_yuku_kg");
            entity.Property(e => e.KabinAgirlikKg).HasColumnName("kabin_agirlik_kg");
            entity.Property(e => e.KarsiAgirlikKg).HasColumnName("karsi_agirlik_kg");
            entity.Property(e => e.KisiSayisi).HasColumnName("kisi_sayisi");
        });

        modelBuilder.Entity<Certificate>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("certificates_pkey");

            entity.ToTable("certificates", tb => tb.HasComment("Ürün sertifikaları (baş kayıt). PDF dosyaları certificate_files'ta sürümlenir."));

            entity.HasIndex(e => e.CertNo, "certificates_cert_no_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.BelgeTipi).HasColumnName("belge_tipi");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.CertNo).HasColumnName("cert_no");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.FirmaAdi).HasColumnName("firma_adi");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.IssueDate).HasColumnName("issue_date");
            entity.Property(e => e.NotifiedBodyId).HasColumnName("notified_body_id");
            entity.Property(e => e.NotifiedBodyRaw).HasColumnName("notified_body_raw");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.ValidUntil).HasColumnName("valid_until");

            entity.HasOne(d => d.Category).WithMany(p => p.Certificates)
                .HasForeignKey(d => d.CategoryId)
                .HasConstraintName("certificates_category_id_fkey");

            entity.HasOne(d => d.NotifiedBody).WithMany(p => p.Certificates)
                .HasForeignKey(d => d.NotifiedBodyId)
                .HasConstraintName("certificates_notified_body_id_fkey");
        });

        modelBuilder.Entity<CertificateFile>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("certificate_files_pkey");

            entity.ToTable("certificate_files");

            entity.HasIndex(e => new { e.CertificateId, e.Version }, "certificate_files_certificate_id_version_key").IsUnique();

            entity.HasIndex(e => e.CertificateId, "uidx_cert_current")
                .IsUnique()
                .HasFilter("is_current");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CertificateId).HasColumnName("certificate_id");
            entity.Property(e => e.IsCurrent)
                .HasDefaultValue(true)
                .HasColumnName("is_current");
            entity.Property(e => e.OriginalName).HasColumnName("original_name");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.UploadedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("uploaded_at");
            entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");
            entity.Property(e => e.Version)
                .HasDefaultValue(1)
                .HasColumnName("version");

            entity.HasOne(d => d.Certificate).WithOne(p => p.CertificateFile)
                .HasForeignKey<CertificateFile>(d => d.CertificateId)
                .HasConstraintName("certificate_files_certificate_id_fkey");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.CertificateFiles)
                .HasForeignKey(d => d.UploadedBy)
                .HasConstraintName("certificate_files_uploaded_by_fkey");
        });

        modelBuilder.Entity<Company>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("companies_pkey");

            entity.ToTable("companies", tb => tb.HasComment("Firma antetleri / montaj-mimarlık firmaları (Firma sayfası)."));

            entity.HasIndex(e => e.ShortName, "idx_companies_short_name");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.AuthorizedPerson).HasColumnName("authorized_person");
            entity.Property(e => e.Category)
                .HasDefaultValueSql("'asansor'::text")
                .HasColumnName("category");
            entity.Property(e => e.CeModule).HasColumnName("ce_module");
            entity.Property(e => e.City).HasColumnName("city");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.Fax).HasColumnName("fax");
            entity.Property(e => e.HybDate).HasColumnName("hyb_date");
            entity.Property(e => e.IndustryRegDate).HasColumnName("industry_reg_date");
            entity.Property(e => e.IndustryRegNo).HasColumnName("industry_reg_no");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.LegalName).HasColumnName("legal_name");
            entity.Property(e => e.MobilePhone).HasColumnName("mobile_phone");
            entity.Property(e => e.MontajFirmaId).HasColumnName("montaj_firma_id");
            entity.Property(e => e.Phone).HasColumnName("phone");
            entity.Property(e => e.RegisteredBrand).HasColumnName("registered_brand");
            entity.Property(e => e.Sector).HasColumnName("sector");
            entity.Property(e => e.ShortName).HasColumnName("short_name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.MontajFirma).WithMany(p => p.InverseMontajFirma)
                .HasForeignKey(d => d.MontajFirmaId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("companies_montaj_firma_id_fkey");
        });

        modelBuilder.Entity<CompanyDocument>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("company_documents_pkey");

            entity.ToTable("company_documents");

            entity.HasIndex(e => e.CompanyId, "idx_company_docs_company");

            entity.HasIndex(e => e.ParentId, "idx_company_docs_parent");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.BelgeNo).HasColumnName("belge_no");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.DocType).HasColumnName("doc_type");
            entity.Property(e => e.IssueDate).HasColumnName("issue_date");
            entity.Property(e => e.NotifiedBodyId).HasColumnName("notified_body_id");
            entity.Property(e => e.OriginalName).HasColumnName("original_name");
            entity.Property(e => e.ParentId).HasColumnName("parent_id");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.SubType).HasColumnName("sub_type");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UploadedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("uploaded_at");
            entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");
            entity.Property(e => e.ValidUntil).HasColumnName("valid_until");

            entity.HasOne(d => d.Company).WithMany(p => p.CompanyDocuments)
                .HasForeignKey(d => d.CompanyId)
                .HasConstraintName("company_documents_company_id_fkey");

            entity.HasOne(d => d.NotifiedBody).WithMany(p => p.CompanyDocuments)
                .HasForeignKey(d => d.NotifiedBodyId)
                .HasConstraintName("company_documents_notified_body_id_fkey");

            entity.HasOne(d => d.Parent).WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("company_documents_parent_id_fkey");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.CompanyDocuments)
                .HasForeignKey(d => d.UploadedBy)
                .HasConstraintName("company_documents_uploaded_by_fkey");
        });

        modelBuilder.Entity<CompanyModuleCert>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("company_module_certs_pkey");

            entity.ToTable("company_module_certs", tb => tb.HasComment("Firmanın modül bazlı CE belgeleri (B MR, B MRL, E, H)."));

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.BelgeNo).HasColumnName("belge_no");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IssueDate).HasColumnName("issue_date");
            entity.Property(e => e.NotifiedBodyId).HasColumnName("notified_body_id");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Company).WithMany(p => p.CompanyModuleCerts)
                .HasForeignKey(d => d.CompanyId)
                .HasConstraintName("company_module_certs_company_id_fkey");

            entity.HasOne(d => d.NotifiedBody).WithMany(p => p.CompanyModuleCerts)
                .HasForeignKey(d => d.NotifiedBodyId)
                .HasConstraintName("company_module_certs_notified_body_id_fkey");
        });

        modelBuilder.Entity<District>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("districts_pkey");

            entity.ToTable("districts");

            entity.HasIndex(e => new { e.ProvinceId, e.Name }, "districts_province_id_name_key").IsUnique();

            entity.HasIndex(e => e.ProvinceId, "idx_districts_province");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.ProvinceId).HasColumnName("province_id");

            entity.HasOne(d => d.Province).WithMany(p => p.Districts)
                .HasForeignKey(d => d.ProvinceId)
                .HasConstraintName("districts_province_id_fkey");
        });

        modelBuilder.Entity<DocumentTemplate>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("document_templates_pkey");

            entity.ToTable("document_templates", tb => tb.HasComment("Her görünür belgenin sürümlenmiş şablonu."));

            entity.HasIndex(e => new { e.DocumentTypeCode, e.Version }, "document_templates_document_type_code_version_key").IsUnique();

            entity.HasIndex(e => e.DocumentTypeCode, "uidx_template_current")
                .IsUnique()
                .HasFilter("is_current");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Body).HasColumnName("body");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.DocumentTypeCode).HasColumnName("document_type_code");
            entity.Property(e => e.IsCurrent)
                .HasDefaultValue(true)
                .HasColumnName("is_current");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.Version)
                .HasDefaultValue(1)
                .HasColumnName("version");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.DocumentTemplates)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("document_templates_created_by_fkey");

            entity.HasOne(d => d.DocumentTypeCodeNavigation).WithOne(p => p.DocumentTemplate)
                .HasPrincipalKey<DocumentType>(p => p.Code)
                .HasForeignKey<DocumentTemplate>(d => d.DocumentTypeCode)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("document_templates_document_type_code_fkey");
        });

        modelBuilder.Entity<DocumentType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("document_types_pkey");

            entity.ToTable("document_types", tb => tb.HasComment("Teknik dosyayı oluşturan görünür alt belgeler (1..17 görünür set)."));

            entity.HasIndex(e => e.Code, "document_types_code_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Code).HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
        });

        modelBuilder.Entity<DownloadLink>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("download_links_pkey");

            entity.ToTable("download_links");

            entity.HasIndex(e => e.Token, "download_links_token_key").IsUnique();

            entity.HasIndex(e => e.GeneratedFileId, "idx_dl_file");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedForEmail).HasColumnName("created_for_email");
            entity.Property(e => e.DownloadCount).HasColumnName("download_count");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.GeneratedFileId).HasColumnName("generated_file_id");
            entity.Property(e => e.IsRevoked).HasColumnName("is_revoked");
            entity.Property(e => e.MaxDownloads).HasColumnName("max_downloads");
            entity.Property(e => e.Token).HasColumnName("token");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.DownloadLinks)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("download_links_created_by_fkey");

            entity.HasOne(d => d.GeneratedFile).WithMany(p => p.DownloadLinks)
                .HasForeignKey(d => d.GeneratedFileId)
                .HasConstraintName("download_links_generated_file_id_fkey");
        });

        modelBuilder.Entity<EmailLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("email_log_pkey");

            entity.ToTable("email_log");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.ProviderId).HasColumnName("provider_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Template).HasColumnName("template");
            entity.Property(e => e.ToEmail).HasColumnName("to_email");

            entity.HasOne(d => d.Project).WithMany(p => p.EmailLogs)
                .HasForeignKey(d => d.ProjectId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("email_log_project_id_fkey");
        });

        modelBuilder.Entity<Engineer>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("engineers_pkey");

            entity.ToTable("engineers");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.ChamberRegNo).HasColumnName("chamber_reg_no");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.FullName).HasColumnName("full_name");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Phone).HasColumnName("phone");
            entity.Property(e => e.Title).HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Company).WithMany(p => p.Engineers)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("engineers_company_id_fkey");
        });

        modelBuilder.Entity<EngineerDocument>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("engineer_documents_pkey");

            entity.ToTable("engineer_documents");

            entity.HasIndex(e => new { e.EngineerId, e.DocType }, "engineer_documents_engineer_id_doc_type_key").IsUnique();

            entity.HasIndex(e => e.EngineerId, "idx_eng_docs_engineer");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.DocType).HasColumnName("doc_type");
            entity.Property(e => e.EngineerId).HasColumnName("engineer_id");
            entity.Property(e => e.OriginalName).HasColumnName("original_name");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UploadedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("uploaded_at");
            entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");
            entity.Property(e => e.ValidUntil).HasColumnName("valid_until");

            entity.HasOne(d => d.Engineer).WithMany(p => p.EngineerDocuments)
                .HasForeignKey(d => d.EngineerId)
                .HasConstraintName("engineer_documents_engineer_id_fkey");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.EngineerDocuments)
                .HasForeignKey(d => d.UploadedBy)
                .HasConstraintName("engineer_documents_uploaded_by_fkey");
        });

        modelBuilder.Entity<EquipmentBrand>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("equipment_brands_pkey");

            entity.ToTable("equipment_brands");

            entity.HasIndex(e => new { e.CategoryId, e.Name }, "equipment_brands_category_id_name_key").IsUnique();

            entity.HasIndex(e => e.CategoryId, "idx_brands_category");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Category).WithMany(p => p.EquipmentBrands)
                .HasForeignKey(d => d.CategoryId)
                .HasConstraintName("equipment_brands_category_id_fkey");
        });

        modelBuilder.Entity<EquipmentCategory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("equipment_categories_pkey");

            entity.ToTable("equipment_categories");

            entity.HasIndex(e => e.Code, "equipment_categories_code_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Code).HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.DriveType)
                .HasDefaultValueSql("'both'::text")
                .HasColumnName("drive_type");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
        });

        modelBuilder.Entity<EquipmentModel>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("equipment_models_pkey");

            entity.ToTable("equipment_models");

            entity.HasIndex(e => new { e.BrandId, e.Name }, "equipment_models_brand_id_name_key").IsUnique();

            entity.HasIndex(e => e.BrandId, "idx_models_brand");

            entity.HasIndex(e => e.CertificateId, "idx_models_cert");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.BrandId).HasColumnName("brand_id");
            entity.Property(e => e.CertificateId).HasColumnName("certificate_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Specs)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("specs");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Brand).WithMany(p => p.EquipmentModels)
                .HasForeignKey(d => d.BrandId)
                .HasConstraintName("equipment_models_brand_id_fkey");

            entity.HasOne(d => d.Certificate).WithMany(p => p.EquipmentModels)
                .HasForeignKey(d => d.CertificateId)
                .HasConstraintName("equipment_models_certificate_id_fkey");

            entity.HasMany(d => d.Certificates).WithMany(p => p.Models)
                .UsingEntity<Dictionary<string, object>>(
                    "ModelCertificate",
                    r => r.HasOne<Certificate>().WithMany()
                        .HasForeignKey("CertificateId")
                        .HasConstraintName("model_certificates_certificate_id_fkey"),
                    l => l.HasOne<EquipmentModel>().WithMany()
                        .HasForeignKey("ModelId")
                        .HasConstraintName("model_certificates_model_id_fkey"),
                    j =>
                    {
                        j.HasKey("ModelId", "CertificateId").HasName("model_certificates_pkey");
                        j.ToTable("model_certificates");
                        j.IndexerProperty<Guid>("ModelId").HasColumnName("model_id");
                        j.IndexerProperty<Guid>("CertificateId").HasColumnName("certificate_id");
                    });
        });

        modelBuilder.Entity<GeneratedFile>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("generated_files_pkey");

            entity.ToTable("generated_files");

            entity.HasIndex(e => e.ProjectId, "idx_genfiles_project");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.DocumentCode).HasColumnName("document_code");
            entity.Property(e => e.FileSize).HasColumnName("file_size");
            entity.Property(e => e.GeneratedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("generated_at");
            entity.Property(e => e.GeneratedBy).HasColumnName("generated_by");
            entity.Property(e => e.PageCount).HasColumnName("page_count");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.Snapshot)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasComment("Üretim anındaki dondurulmuş referanslar — resmi belge sonradan değişmez.")
                .HasColumnType("jsonb")
                .HasColumnName("snapshot");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.Version)
                .HasDefaultValue(1)
                .HasColumnName("version");

            entity.HasOne(d => d.DocumentCodeNavigation).WithMany(p => p.GeneratedFiles)
                .HasPrincipalKey(p => p.Code)
                .HasForeignKey(d => d.DocumentCode)
                .HasConstraintName("generated_files_document_code_fkey");

            entity.HasOne(d => d.GeneratedByNavigation).WithMany(p => p.GeneratedFiles)
                .HasForeignKey(d => d.GeneratedBy)
                .HasConstraintName("generated_files_generated_by_fkey");

            entity.HasOne(d => d.Project).WithMany(p => p.GeneratedFiles)
                .HasForeignKey(d => d.ProjectId)
                .HasConstraintName("generated_files_project_id_fkey");
        });

        modelBuilder.Entity<IlgiliIdareler>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("ilgili_idareler_pkey");

            entity.ToTable("ilgili_idareler");

            entity.HasIndex(e => e.ProvinceId, "ilgili_idareler_province_idx");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.ProvinceId).HasColumnName("province_id");
            entity.Property(e => e.Suffix)
                .HasDefaultValueSql("'belediye'::text")
                .HasColumnName("suffix");

            entity.HasOne(d => d.Province).WithMany(p => p.IlgiliIdarelers)
                .HasForeignKey(d => d.ProvinceId)
                .HasConstraintName("ilgili_idareler_province_id_fkey");
        });

        modelBuilder.Entity<LookupValue>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("lookup_values_pkey");

            entity.ToTable("lookup_values");

            entity.HasIndex(e => e.ListKey, "idx_lookup_list");

            entity.HasIndex(e => new { e.ListKey, e.Value }, "lookup_values_list_key_value_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.ListKey).HasColumnName("list_key");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.Value).HasColumnName("value");
        });

        modelBuilder.Entity<NotifiedBody>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("notified_bodies_pkey");

            entity.ToTable("notified_bodies", tb => tb.HasComment("CE onaylanmış kuruluşlar (Diğer Bilgiler sayfası)."));

            entity.HasIndex(e => e.IdentityNo, "notified_bodies_identity_no_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.City).HasColumnName("city");
            entity.Property(e => e.Country).HasColumnName("country");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IdentityNo).HasColumnName("identity_no");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.ShortName).HasColumnName("short_name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<Notlar>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("notlar_pkey");

            entity.ToTable("notlar");

            entity.HasIndex(e => e.UserId, "notlar_user_idx");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Icerik).HasColumnName("icerik");
            entity.Property(e => e.SayacBaslangic)
                .HasDefaultValueSql("now()")
                .HasColumnName("sayac_baslangic");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.Notlars)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("notlar_user_id_fkey");
        });

        modelBuilder.Entity<Plan>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("plans_pkey");

            entity.ToTable("plans");

            entity.HasIndex(e => e.Code, "plans_code_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Code).HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.OveragePrice)
                .HasPrecision(10, 2)
                .HasColumnName("overage_price");
            entity.Property(e => e.PriceMonthly)
                .HasPrecision(10, 2)
                .HasColumnName("price_monthly");
            entity.Property(e => e.PriceYearly)
                .HasPrecision(10, 2)
                .HasColumnName("price_yearly");
            entity.Property(e => e.QuotaPerPeriod).HasColumnName("quota_per_period");
        });

        modelBuilder.Entity<Profile>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("profiles_pkey");

            entity.ToTable("profiles");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.FullName).HasColumnName("full_name");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Company).WithMany(p => p.Profiles)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_profiles_company");

            entity.HasOne(d => d.IdNavigation).WithOne(p => p.Profile)
                .HasForeignKey<Profile>(d => d.Id)
                .HasConstraintName("profiles_id_fkey");
        });

        modelBuilder.Entity<ProjeOnay>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("proje_onay_pkey");

            entity.ToTable("proje_onay");

            entity.HasIndex(e => e.CompanyId, "idx_proje_onay_company");

            entity.HasIndex(e => e.CreatedAt, "idx_proje_onay_created");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Ada).HasColumnName("ada");
            entity.Property(e => e.AsansorAdedi)
                .HasDefaultValue(1)
                .HasColumnName("asansor_adedi");
            entity.Property(e => e.BeyanHizi)
                .HasPrecision(4, 2)
                .HasColumnName("beyan_hizi");
            entity.Property(e => e.BeyanYukuKg).HasColumnName("beyan_yuku_kg");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.DilekceTarihi).HasColumnName("dilekce_tarihi");
            entity.Property(e => e.DistrictId).HasColumnName("district_id");
            entity.Property(e => e.DosyaNo).HasColumnName("dosya_no");
            entity.Property(e => e.DurakSayisi).HasColumnName("durak_sayisi");
            entity.Property(e => e.ElektrikMuhendisId).HasColumnName("elektrik_muhendis_id");
            entity.Property(e => e.IlgiliIdareId).HasColumnName("ilgili_idare_id");
            entity.Property(e => e.InputData)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("input_data");
            entity.Property(e => e.KisiSayisi).HasColumnName("kisi_sayisi");
            entity.Property(e => e.MakineMuhendisId).HasColumnName("makine_muhendis_id");
            entity.Property(e => e.MontajAdresi).HasColumnName("montaj_adresi");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.Pafta).HasColumnName("pafta");
            entity.Property(e => e.Parsel).HasColumnName("parsel");
            entity.Property(e => e.ProvinceId).HasColumnName("province_id");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'draft'::text")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.YapiSahibi).HasColumnName("yapi_sahibi");

            entity.HasOne(d => d.Company).WithMany(p => p.ProjeOnays)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("proje_onay_company_id_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.ProjeOnays)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("proje_onay_created_by_fkey");

            entity.HasOne(d => d.District).WithMany(p => p.ProjeOnays)
                .HasForeignKey(d => d.DistrictId)
                .HasConstraintName("proje_onay_district_id_fkey");

            entity.HasOne(d => d.ElektrikMuhendis).WithMany(p => p.ProjeOnayElektrikMuhendis)
                .HasForeignKey(d => d.ElektrikMuhendisId)
                .HasConstraintName("proje_onay_elektrik_muhendis_id_fkey");

            entity.HasOne(d => d.IlgiliIdare).WithMany(p => p.ProjeOnays)
                .HasForeignKey(d => d.IlgiliIdareId)
                .HasConstraintName("proje_onay_ilgili_idare_id_fkey");

            entity.HasOne(d => d.MakineMuhendis).WithMany(p => p.ProjeOnayMakineMuhendis)
                .HasForeignKey(d => d.MakineMuhendisId)
                .HasConstraintName("proje_onay_makine_muhendis_id_fkey");

            entity.HasOne(d => d.Province).WithMany(p => p.ProjeOnays)
                .HasForeignKey(d => d.ProvinceId)
                .HasConstraintName("proje_onay_province_id_fkey");
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("projects_pkey");

            entity.ToTable("projects", tb => tb.HasComment("Teknik dosya projesi — input_data = Veri Girişi anlık görüntüsü."));

            entity.HasIndex(e => e.CompanyId, "idx_projects_company");

            entity.HasIndex(e => e.CreatedBy, "idx_projects_created_by");

            entity.HasIndex(e => e.TdNo, "idx_projects_td_no");

            entity.HasIndex(e => new { e.CompanyId, e.DosyaNo }, "projects_company_id_dosya_no_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.AssignedEngineer).HasColumnName("assigned_engineer");
            entity.Property(e => e.BeyanHizi)
                .HasPrecision(4, 2)
                .HasColumnName("beyan_hizi");
            entity.Property(e => e.BeyanYukuKg).HasColumnName("beyan_yuku_kg");
            entity.Property(e => e.BinaAdi).HasColumnName("bina_adi");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.DistrictId).HasColumnName("district_id");
            entity.Property(e => e.DosyaNo).HasColumnName("dosya_no");
            entity.Property(e => e.DosyaTarihi).HasColumnName("dosya_tarihi");
            entity.Property(e => e.DurakAdedi).HasColumnName("durak_adedi");
            entity.Property(e => e.ElektrikMuhendisId).HasColumnName("elektrik_muhendis_id");
            entity.Property(e => e.ImalYili).HasColumnName("imal_yili");
            entity.Property(e => e.InputData)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("input_data");
            entity.Property(e => e.KatAdedi).HasColumnName("kat_adedi");
            entity.Property(e => e.KisiSayisi).HasColumnName("kisi_sayisi");
            entity.Property(e => e.MakineMuhendisId).HasColumnName("makine_muhendis_id");
            entity.Property(e => e.MontajAdresi).HasColumnName("montaj_adresi");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.ProvinceId).HasColumnName("province_id");
            entity.Property(e => e.TdNo).HasColumnName("td_no");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.AssignedEngineerNavigation).WithMany(p => p.ProjectAssignedEngineerNavigations)
                .HasForeignKey(d => d.AssignedEngineer)
                .HasConstraintName("projects_assigned_engineer_fkey");

            entity.HasOne(d => d.Company).WithMany(p => p.Projects)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("projects_company_id_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.ProjectCreatedByNavigations)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("projects_created_by_fkey");

            entity.HasOne(d => d.District).WithMany(p => p.Projects)
                .HasForeignKey(d => d.DistrictId)
                .HasConstraintName("projects_district_id_fkey");

            entity.HasOne(d => d.ElektrikMuhendis).WithMany(p => p.ProjectElektrikMuhendis)
                .HasForeignKey(d => d.ElektrikMuhendisId)
                .HasConstraintName("projects_elektrik_muhendis_id_fkey");

            entity.HasOne(d => d.MakineMuhendis).WithMany(p => p.ProjectMakineMuhendis)
                .HasForeignKey(d => d.MakineMuhendisId)
                .HasConstraintName("projects_makine_muhendis_id_fkey");

            entity.HasOne(d => d.Province).WithMany(p => p.Projects)
                .HasForeignKey(d => d.ProvinceId)
                .HasConstraintName("projects_province_id_fkey");
        });

        modelBuilder.Entity<ProjectEquipment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("project_equipment_pkey");

            entity.ToTable("project_equipment");

            entity.HasIndex(e => e.ProjectId, "idx_projeq_project");

            entity.HasIndex(e => new { e.ProjectId, e.CategoryId, e.Slot }, "project_equipment_project_id_category_id_slot_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.BrandId).HasColumnName("brand_id");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.CertificateId).HasColumnName("certificate_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.ModelId).HasColumnName("model_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.SeriList)
                .HasColumnType("jsonb")
                .HasColumnName("seri_list");
            entity.Property(e => e.SeriNo).HasColumnName("seri_no");
            entity.Property(e => e.Slot)
                .HasDefaultValueSql("'main'::text")
                .HasColumnName("slot");

            entity.HasOne(d => d.Brand).WithMany(p => p.ProjectEquipments)
                .HasForeignKey(d => d.BrandId)
                .HasConstraintName("project_equipment_brand_id_fkey");

            entity.HasOne(d => d.Category).WithMany(p => p.ProjectEquipments)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("project_equipment_category_id_fkey");

            entity.HasOne(d => d.Certificate).WithMany(p => p.ProjectEquipments)
                .HasForeignKey(d => d.CertificateId)
                .HasConstraintName("project_equipment_certificate_id_fkey");

            entity.HasOne(d => d.Model).WithMany(p => p.ProjectEquipments)
                .HasForeignKey(d => d.ModelId)
                .HasConstraintName("project_equipment_model_id_fkey");

            entity.HasOne(d => d.Project).WithMany(p => p.ProjectEquipments)
                .HasForeignKey(d => d.ProjectId)
                .HasConstraintName("project_equipment_project_id_fkey");
        });

        modelBuilder.Entity<ProjectFile>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("project_files_pkey");

            entity.ToTable("project_files");

            entity.HasIndex(e => new { e.ProjectId, e.Kind }, "idx_project_files_kind");

            entity.HasIndex(e => e.ProjectId, "idx_project_files_project");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.BelgeNo).HasColumnName("belge_no");
            entity.Property(e => e.FaturaNo).HasColumnName("fatura_no");
            entity.Property(e => e.FaturaTarihi).HasColumnName("fatura_tarihi");
            entity.Property(e => e.IssueDate).HasColumnName("issue_date");
            entity.Property(e => e.Kind).HasColumnName("kind");
            entity.Property(e => e.NotifiedBodyId).HasColumnName("notified_body_id");
            entity.Property(e => e.OriginalName).HasColumnName("original_name");
            entity.Property(e => e.ProjeNo).HasColumnName("proje_no");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.ReportDate).HasColumnName("report_date");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.UploadedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("uploaded_at");
            entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");
            entity.Property(e => e.ValidUntil).HasColumnName("valid_until");

            entity.HasOne(d => d.NotifiedBody).WithMany(p => p.ProjectFiles)
                .HasForeignKey(d => d.NotifiedBodyId)
                .HasConstraintName("project_files_notified_body_id_fkey");

            entity.HasOne(d => d.Project).WithMany(p => p.ProjectFiles)
                .HasForeignKey(d => d.ProjectId)
                .HasConstraintName("project_files_project_id_fkey");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.ProjectFiles)
                .HasForeignKey(d => d.UploadedBy)
                .HasConstraintName("project_files_uploaded_by_fkey");
        });

        modelBuilder.Entity<Province>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("provinces_pkey");

            entity.ToTable("provinces");

            entity.HasIndex(e => e.Name, "provinces_name_key").IsUnique();

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("subscriptions_pkey");

            entity.ToTable("subscriptions");

            entity.HasIndex(e => e.CompanyId, "idx_subs_company");

            entity.HasIndex(e => e.CompanyId, "uidx_sub_active")
                .IsUnique()
                .HasFilter("(status = ANY (ARRAY['trialing'::subscription_status, 'active'::subscription_status]))");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CurrentPeriodEnd).HasColumnName("current_period_end");
            entity.Property(e => e.CurrentPeriodStart)
                .HasDefaultValueSql("CURRENT_DATE")
                .HasColumnName("current_period_start");
            entity.Property(e => e.FilesUsed).HasColumnName("files_used");
            entity.Property(e => e.IsInternal).HasColumnName("is_internal");
            entity.Property(e => e.PlanId).HasColumnName("plan_id");
            entity.Property(e => e.QuotaPerPeriod).HasColumnName("quota_per_period");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Company).WithOne(p => p.Subscription)
                .HasForeignKey<Subscription>(d => d.CompanyId)
                .HasConstraintName("subscriptions_company_id_fkey");

            entity.HasOne(d => d.Plan).WithMany(p => p.Subscriptions)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("subscriptions_plan_id_fkey");
        });

        modelBuilder.Entity<TakipCounter>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("takip_counter_pkey");

            entity.ToTable("takip_counter");

            entity.Property(e => e.Id)
                .HasDefaultValue(1)
                .HasColumnName("id");
            entity.Property(e => e.NextNo)
                .HasDefaultValue(1001)
                .HasColumnName("next_no");
        });

        modelBuilder.Entity<TakipDokumanlar>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("takip_dokumanlar_pkey");

            entity.ToTable("takip_dokumanlar");

            entity.HasIndex(e => e.TakipId, "takip_dokumanlar_takip_idx");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Kind).HasColumnName("kind");
            entity.Property(e => e.OriginalName).HasColumnName("original_name");
            entity.Property(e => e.StoragePath).HasColumnName("storage_path");
            entity.Property(e => e.TakipId).HasColumnName("takip_id");
            entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");

            entity.HasOne(d => d.Takip).WithMany(p => p.TakipDokumanlars)
                .HasForeignKey(d => d.TakipId)
                .HasConstraintName("takip_dokumanlar_takip_id_fkey");
        });

        modelBuilder.Entity<TakipMuhasebe>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("takip_muhasebe_pkey");

            entity.ToTable("takip_muhasebe");

            entity.HasIndex(e => e.TakipId, "takip_muhasebe_takip_id_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CariyeIslendi).HasColumnName("cariye_islendi");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.FaturaNo).HasColumnName("fatura_no");
            entity.Property(e => e.FaturaTarihi).HasColumnName("fatura_tarihi");
            entity.Property(e => e.KargoSirketi).HasColumnName("kargo_sirketi");
            entity.Property(e => e.KargoTakipNo).HasColumnName("kargo_takip_no");
            entity.Property(e => e.TakipId).HasColumnName("takip_id");
            entity.Property(e => e.TeslimTarihi).HasColumnName("teslim_tarihi");
            entity.Property(e => e.TeslimYontemi).HasColumnName("teslim_yontemi");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Takip).WithOne(p => p.TakipMuhasebe)
                .HasForeignKey<TakipMuhasebe>(d => d.TakipId)
                .HasConstraintName("takip_muhasebe_takip_id_fkey");
        });

        modelBuilder.Entity<TakipProjeler>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("takip_projeler_pkey");

            entity.ToTable("takip_projeler");

            entity.HasIndex(e => new { e.MuhasebeyeGonderildi, e.MuhasebeDurumu }, "takip_projeler_muh_idx");

            entity.HasIndex(e => e.ParentId, "takip_projeler_parent_idx");

            entity.HasIndex(e => e.ProjeSorumlusuId, "takip_projeler_sorumlu_idx");

            entity.HasIndex(e => e.TdNo, "takip_projeler_td_no_idx");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Ada).HasColumnName("ada");
            entity.Property(e => e.AdaParsel).HasColumnName("ada_parsel");
            entity.Property(e => e.AsansorSayisi).HasColumnName("asansor_sayisi");
            entity.Property(e => e.AsansorSeriNo).HasColumnName("asansor_seri_no");
            entity.Property(e => e.AsansorTipi).HasColumnName("asansor_tipi");
            entity.Property(e => e.BekliyorAciklama).HasColumnName("bekliyor_aciklama");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.DistrictId).HasColumnName("district_id");
            entity.Property(e => e.Durum)
                .HasDefaultValueSql("'HAZIRLANIYOR'::text")
                .HasColumnName("durum");
            entity.Property(e => e.FaturaTipi).HasColumnName("fatura_tipi");
            entity.Property(e => e.Fiyat)
                .HasPrecision(14, 2)
                .HasColumnName("fiyat");
            entity.Property(e => e.HardCopyAdedi).HasColumnName("hard_copy_adedi");
            entity.Property(e => e.IlAdi).HasColumnName("il_adi");
            entity.Property(e => e.IlceAdi).HasColumnName("ilce_adi");
            entity.Property(e => e.IsAdi).HasColumnName("is_adi");
            entity.Property(e => e.MontajFirmaId).HasColumnName("montaj_firma_id");
            entity.Property(e => e.MuhasebeDurumu).HasColumnName("muhasebe_durumu");
            entity.Property(e => e.MuhasebeyeGonderildi).HasColumnName("muhasebeye_gonderildi");
            entity.Property(e => e.ParentId).HasColumnName("parent_id");
            entity.Property(e => e.Parsel).HasColumnName("parsel");
            entity.Property(e => e.ProjeNo).HasColumnName("proje_no");
            entity.Property(e => e.ProjeSorumlusuId).HasColumnName("proje_sorumlusu_id");
            entity.Property(e => e.ProjeTipi).HasColumnName("proje_tipi");
            entity.Property(e => e.ProvinceId).HasColumnName("province_id");
            entity.Property(e => e.RevAciklama).HasColumnName("rev_aciklama");
            entity.Property(e => e.RevNo).HasColumnName("rev_no");
            entity.Property(e => e.RevTarihi).HasColumnName("rev_tarihi");
            entity.Property(e => e.SiparisTarihi).HasColumnName("siparis_tarihi");
            entity.Property(e => e.TahminiTamamlanma).HasColumnName("tahmini_tamamlanma");
            entity.Property(e => e.TamamlanmaTarihi).HasColumnName("tamamlanma_tarihi");
            entity.Property(e => e.TdNo).HasColumnName("td_no");
            entity.Property(e => e.TeslimTipi).HasColumnName("teslim_tipi");
            entity.Property(e => e.ToplamTutar)
                .HasPrecision(14, 2)
                .HasColumnName("toplam_tutar");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Company).WithMany(p => p.TakipProjelerCompanies)
                .HasForeignKey(d => d.CompanyId)
                .HasConstraintName("takip_projeler_company_id_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.TakipProjelerCreatedByNavigations)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("takip_projeler_created_by_fkey");

            entity.HasOne(d => d.MontajFirma).WithMany(p => p.TakipProjelerMontajFirmas)
                .HasForeignKey(d => d.MontajFirmaId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("takip_projeler_montaj_firma_id_fkey");

            entity.HasOne(d => d.Parent).WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("takip_projeler_parent_id_fkey");

            entity.HasOne(d => d.ProjeSorumlusu).WithMany(p => p.TakipProjelerProjeSorumlusus)
                .HasForeignKey(d => d.ProjeSorumlusuId)
                .HasConstraintName("takip_projeler_proje_sorumlusu_id_fkey");
        });

        modelBuilder.Entity<TemplateField>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("template_fields_pkey");

            entity.ToTable("template_fields", tb => tb.HasComment("Her belge alanının veri kaynağı eşlemesi (Excel referanslarının DB karşılığı)."));

            entity.HasIndex(e => e.TemplateId, "idx_tfields_template");

            entity.HasIndex(e => new { e.TemplateId, e.FieldKey }, "template_fields_template_id_field_key_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Config)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("config");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.DefaultValue).HasColumnName("default_value");
            entity.Property(e => e.FieldKey).HasColumnName("field_key");
            entity.Property(e => e.FormatPattern).HasColumnName("format_pattern");
            entity.Property(e => e.IsRequired).HasColumnName("is_required");
            entity.Property(e => e.Label).HasColumnName("label");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.SourceKey).HasColumnName("source_key");
            entity.Property(e => e.TemplateId).HasColumnName("template_id");

            entity.HasOne(d => d.Template).WithMany(p => p.TemplateFields)
                .HasForeignKey(d => d.TemplateId)
                .HasConstraintName("template_fields_template_id_fkey");
        });

        modelBuilder.Entity<UsageRecord>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("usage_records_pkey");

            entity.ToTable("usage_records");

            entity.HasIndex(e => new { e.CompanyId, e.OccurredAt }, "idx_usage_company");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.IsOverage).HasColumnName("is_overage");
            entity.Property(e => e.OccurredAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("occurred_at");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.Quantity)
                .HasDefaultValue(1)
                .HasColumnName("quantity");
            entity.Property(e => e.SubscriptionId).HasColumnName("subscription_id");

            entity.HasOne(d => d.Company).WithMany(p => p.UsageRecords)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("usage_records_company_id_fkey");

            entity.HasOne(d => d.Project).WithMany(p => p.UsageRecords)
                .HasForeignKey(d => d.ProjectId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("usage_records_project_id_fkey");

            entity.HasOne(d => d.Subscription).WithMany(p => p.UsageRecords)
                .HasForeignKey(d => d.SubscriptionId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("usage_records_subscription_id_fkey");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("users_pkey");

            entity.ToTable("users");

            entity.HasIndex(e => e.Email, "users_email_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.LastSignInAt).HasColumnName("last_sign_in_at");
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
        });

        modelBuilder.Entity<VEquipmentCatalog>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_equipment_catalog");

            entity.Property(e => e.BrandId).HasColumnName("brand_id");
            entity.Property(e => e.BrandName).HasColumnName("brand_name");
            entity.Property(e => e.CategoryCode).HasColumnName("category_code");
            entity.Property(e => e.CategoryName).HasColumnName("category_name");
            entity.Property(e => e.CertificateCurrentFile).HasColumnName("certificate_current_file");
            entity.Property(e => e.CertificateNo).HasColumnName("certificate_no");
            entity.Property(e => e.ModelId).HasColumnName("model_id");
            entity.Property(e => e.ModelName).HasColumnName("model_name");
            entity.Property(e => e.NotifiedBodyName).HasColumnName("notified_body_name");
            entity.Property(e => e.NotifiedBodyNo).HasColumnName("notified_body_no");
        });

        modelBuilder.Entity<VProjectOverview>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_project_overview");

            entity.Property(e => e.BeyanYukuKg).HasColumnName("beyan_yuku_kg");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DosyaNo).HasColumnName("dosya_no");
            entity.Property(e => e.DurakAdedi).HasColumnName("durak_adedi");
            entity.Property(e => e.Firma).HasColumnName("firma");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Il).HasColumnName("il");
            entity.Property(e => e.KatAdedi).HasColumnName("kat_adedi");
            entity.Property(e => e.Olusturan).HasColumnName("olusturan");
            entity.Property(e => e.SonUretim).HasColumnName("son_uretim");
            entity.Property(e => e.UretilenDosya).HasColumnName("uretilen_dosya");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
