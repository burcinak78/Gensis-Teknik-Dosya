using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GensisTd.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "document_library",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    doc_type = table.Column<string>(type: "text", nullable: false),
                    storage_path = table.Column<string>(type: "text", nullable: false),
                    original_name = table.Column<string>(type: "text", nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    archived_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    archived_by = table.Column<Guid>(type: "uuid", nullable: true),
                    uploaded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("document_library_pkey", x => x.id);
                    table.CheckConstraint("document_library_archived_not_default_check", "NOT (is_default AND archived_at IS NOT NULL)");
                    table.CheckConstraint("document_library_doc_type_check", "doc_type IN ('bakim_sozlesmesi','son_kontrol_formu','kullanma_bakim_klavuzu','seyir_defteri','egitim_tutanagi','teslim_tutanagi')");
                    table.ForeignKey(
                        name: "document_library_archived_by_fkey",
                        column: x => x.archived_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "document_library_company_id_fkey",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "document_library_uploaded_by_fkey",
                        column: x => x.uploaded_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "project_document_choices",
                columns: table => new
                {
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    doc_type = table.Column<string>(type: "text", nullable: false),
                    library_document_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("project_document_choices_pkey", x => new { x.project_id, x.doc_type });
                    table.ForeignKey(
                        name: "project_document_choices_library_document_id_fkey",
                        column: x => x.library_document_id,
                        principalTable: "document_library",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "project_document_choices_project_id_fkey",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "project_document_choices_updated_by_fkey",
                        column: x => x.updated_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "document_library_one_default_key",
                table: "document_library",
                columns: new[] { "company_id", "doc_type" },
                unique: true,
                filter: "is_default AND archived_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "document_library_storage_path_key",
                table: "document_library",
                column: "storage_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_document_library_company_type",
                table: "document_library",
                columns: new[] { "company_id", "doc_type" });

            migrationBuilder.CreateIndex(
                name: "IX_document_library_archived_by",
                table: "document_library",
                column: "archived_by");

            migrationBuilder.CreateIndex(
                name: "IX_document_library_uploaded_by",
                table: "document_library",
                column: "uploaded_by");

            migrationBuilder.CreateIndex(
                name: "idx_project_document_choices_document",
                table: "project_document_choices",
                column: "library_document_id");

            migrationBuilder.CreateIndex(
                name: "IX_project_document_choices_updated_by",
                table: "project_document_choices",
                column: "updated_by");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_document_choices");

            migrationBuilder.DropTable(
                name: "document_library");
        }
    }
}
