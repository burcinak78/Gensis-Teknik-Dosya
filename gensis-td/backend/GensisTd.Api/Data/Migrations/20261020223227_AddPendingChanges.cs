using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GensisTd.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPendingChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pending_changes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    kind = table.Column<string>(type: "text", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_id = table.Column<Guid>(type: "uuid", nullable: true),
                    engineer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    doc_type = table.Column<string>(type: "text", nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    storage_path = table.Column<string>(type: "text", nullable: true),
                    original_name = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'pending'"),
                    note = table.Column<string>(type: "text", nullable: true),
                    submitted_by = table.Column<Guid>(type: "uuid", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pending_changes_pkey", x => x.id);
                    table.CheckConstraint("pending_changes_kind_check", "kind IN ('company_edit', 'engineer_new', 'engineer_edit', 'company_doc', 'engineer_doc')");
                    table.CheckConstraint("pending_changes_status_check", "status IN ('pending', 'approved', 'rejected')");
                    table.ForeignKey(
                        name: "pending_changes_company_id_fkey",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "pending_changes_engineer_id_fkey",
                        column: x => x.engineer_id,
                        principalTable: "engineers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "pending_changes_reviewed_by_fkey",
                        column: x => x.reviewed_by,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "pending_changes_submitted_by_fkey",
                        column: x => x.submitted_by,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "idx_pending_changes_company",
                table: "pending_changes",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "idx_pending_changes_status",
                table: "pending_changes",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_pending_changes_engineer_id",
                table: "pending_changes",
                column: "engineer_id");

            migrationBuilder.CreateIndex(
                name: "IX_pending_changes_reviewed_by",
                table: "pending_changes",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "IX_pending_changes_submitted_by",
                table: "pending_changes",
                column: "submitted_by");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pending_changes");
        }
    }
}
