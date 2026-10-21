using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GensisTd.Api.Data;

// One-shot setup run as `dotnet GensisTd.Api.dll migrate` with the database owner's connection string.
// The API itself connects as the restricted app role (KRR-016), so it never holds owner or superuser rights,
// the admin seed password or the migration history.
public static class DbMigrator
{
    public static async Task RunAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        var appUser = config["DB_APP_USER"];
        var appPassword = config["DB_APP_PASSWORD"];
        if (string.IsNullOrEmpty(appUser) || string.IsNullOrEmpty(appPassword))
            throw new InvalidOperationException("DB_APP_USER and DB_APP_PASSWORD must be set");
        await EnsureAppRoleAsync(db, appUser, appPassword);
        logger.LogInformation("App role {Role} is up to date", appUser);

        // Npgsql caches database types on first connect; reload so enums created by the migration are known.
        var conn = (NpgsqlConnection)db.Database.GetDbConnection();
        await conn.OpenAsync();
        await conn.ReloadTypesAsync();
        await conn.CloseAsync();
        await AdminSeeder.SeedAsync(db, config, logger);
    }

    // Login role with data access only: no superuser, createdb, createrole or DDL. Re-run on every deploy so
    // tables added by new migrations are granted and a changed password takes effect.
    private static async Task EnsureAppRoleAsync(AppDbContext db, string user, string password)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        // DDL cannot take parameters; pass the values as transaction-local settings and quote them with format().
        await db.Database.ExecuteSqlAsync(
            $"SELECT set_config('gtd.app_user', {user}, true), set_config('gtd.app_password', {password}, true)");
        await db.Database.ExecuteSqlRawAsync("""
            DO $$
            DECLARE
                u text := current_setting('gtd.app_user');
                p text := current_setting('gtd.app_password');
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = u) THEN
                    EXECUTE format('CREATE ROLE %I', u);
                END IF;
                EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', u, p);
                EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), u);
                REVOKE CREATE ON SCHEMA public FROM PUBLIC;
                EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', u);
                EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', u);
                EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', u);
                EXECUTE format('REVOKE ALL ON TABLE public."__EFMigrationsHistory" FROM %I', u);
                -- Database functions the API calls. HardenDbFunctions revoked them from PUBLIC; only SECURITY INVOKER ones belong here.
                EXECUTE format('GRANT EXECUTE ON FUNCTION public.project_render_context(uuid) TO %I', u);
            END $$;
            """);
        await tx.CommitAsync();
    }
}
