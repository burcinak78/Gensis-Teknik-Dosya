using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GensisTd.Api.Data.Migrations
{
    /// <summary>
    /// Schema copied from Supabase (db/supabase/adapt_schema.py → Data/Sql/supabase_baseline.sql), plus the users
    /// table that replaces auth.users. Raw SQL keeps it identical to the source for the data migration; the model
    /// snapshot still describes it, so later migrations diff normally.
    /// </summary>
    public partial class Baseline : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE public.users (
                    id uuid DEFAULT gen_random_uuid() NOT NULL,
                    email text NOT NULL,
                    password_hash text NOT NULL,
                    created_at timestamp with time zone DEFAULT now() NOT NULL,
                    last_sign_in_at timestamp with time zone,
                    CONSTRAINT users_pkey PRIMARY KEY (id),
                    CONSTRAINT users_email_key UNIQUE (email)
                );
                """);
            migrationBuilder.Sql(ReadSql("supabase_baseline.sql"));
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        }

        private static string ReadSql(string name)
        {
            var assembly = typeof(Baseline).Assembly;
            var resource = assembly.GetManifestResourceNames().Single(n => n.EndsWith("." + name));
            using var reader = new StreamReader(assembly.GetManifestResourceStream(resource)!);
            return reader.ReadToEnd();
        }
    }
}
