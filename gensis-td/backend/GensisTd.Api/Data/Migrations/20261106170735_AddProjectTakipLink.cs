using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GensisTd.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectTakipLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "takip_id",
                table: "projects",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "idx_projects_takip",
                table: "projects",
                column: "takip_id");

            migrationBuilder.AddForeignKey(
                name: "projects_takip_id_fkey",
                table: "projects",
                column: "takip_id",
                principalTable: "takip_projeler",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "projects_takip_id_fkey",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "idx_projects_takip",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "takip_id",
                table: "projects");
        }
    }
}
