using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GensisTd.Api.Data.Migrations
{
    /// <summary>
    /// KRR-011/012 carried over from the live Supabase fix, one step further:
    /// project_render_context runs with the caller's rights (it was SECURITY DEFINER and readable for
    /// any project id), and neither function is executable by PUBLIC. The backend role owns both.
    /// </summary>
    public partial class HardenDbFunctions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER FUNCTION public.project_render_context(uuid) SECURITY INVOKER;
                REVOKE EXECUTE ON FUNCTION public.project_render_context(uuid) FROM PUBLIC;
                REVOKE EXECUTE ON FUNCTION public.next_takip_no() FROM PUBLIC;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                GRANT EXECUTE ON FUNCTION public.next_takip_no() TO PUBLIC;
                GRANT EXECUTE ON FUNCTION public.project_render_context(uuid) TO PUBLIC;
                ALTER FUNCTION public.project_render_context(uuid) SECURITY DEFINER;
                """);
        }
    }
}
