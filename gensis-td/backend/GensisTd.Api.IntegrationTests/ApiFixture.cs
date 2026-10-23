using System.Net.Http.Json;
using Amazon.Runtime;
using Amazon.S3;
using GensisTd.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// One throwaway database per run: migrated by <see cref="DbMigrator"/> as the owner, seeded with <see cref="Seed"/>,
/// then the API runs in-process as the restricted app role (KRR-016), exactly as in production.
/// Settings come from the environment (integration-tests.sh):
///   GTD_IT_DB              owner connection string to an existing database (e.g. postgres)
///   GTD_IT_STORAGE_URL     MinIO endpoint, GTD_IT_STORAGE_KEY / GTD_IT_STORAGE_SECRET its credentials
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    private readonly string _suffix = Guid.NewGuid().ToString("N")[..12];
    private string DbName => $"gtd_it_{_suffix}";
    private string AppRole => $"gtd_it_app_{_suffix}";
    private readonly string _appPassword = Guid.NewGuid().ToString("N");

    private WebApplicationFactory<Program> _factory = null!;
    private readonly Dictionary<string, HttpClient> _clients = [];

    /// <summary>Owner connection to the test database, for seeding and for checking what a request changed.</summary>
    public string OwnerConnection { get; private set; } = "";

    private static string Env(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } v
            ? v
            : throw new InvalidOperationException($"{name} is not set; run backend/integration-tests.sh");

    public async Task InitializeAsync()
    {
        var admin = new NpgsqlConnectionStringBuilder(Env("GTD_IT_DB"));
        await using (var conn = new NpgsqlConnection(admin.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{DbName}\"", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        OwnerConnection = new NpgsqlConnectionStringBuilder(admin.ConnectionString) { Database = DbName }.ConnectionString;

        await MigrateAsync();
        await Seed.RunAsync(OwnerConnection);

        var app = new NpgsqlConnectionStringBuilder(OwnerConnection) { Username = AppRole, Password = _appPassword };
        // Program reads its settings while building, so they go in as environment variables, as in the container.
        var settings = new Dictionary<string, string>
        {
            ["ConnectionStrings__Default"] = app.ConnectionString,
            ["Auth__JwtSecret"] = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48)),
            ["Auth__SecureCookie"] = "false",
            ["Storage__Endpoint"] = Env("GTD_IT_STORAGE_URL"),
            ["Storage__AccessKey"] = Env("GTD_IT_STORAGE_KEY"),
            ["Storage__SecretKey"] = Env("GTD_IT_STORAGE_SECRET"),
            ["GENSIS_COMPANY_ID"] = Seed.CompanyGensis.ToString(),
        };
        foreach (var (k, v) in settings) Environment.SetEnvironmentVariable(k, v);

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
            b.ConfigureLogging(l => l.SetMinimumLevel(LogLevel.Warning)));
        _ = _factory.Server; // starts the app; it creates the buckets
        await PutObjectsAsync();
    }

    private async Task MigrateAsync()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DB_APP_USER"] = AppRole,
            ["DB_APP_PASSWORD"] = _appPassword,
        }).Build();
        await using var services = new ServiceCollection()
            .AddDbContext<AppDbContext>(o => o.UseNpgsql(OwnerConnection, AppDbContext.MapEnums))
            .BuildServiceProvider();
        await DbMigrator.RunAsync(services, config, NullLogger.Instance);
    }

    // Objects behind the seeded rows, so a 404 from the file routes can only come from the access check.
    private async Task PutObjectsAsync()
    {
        using var s3 = new AmazonS3Client(new BasicAWSCredentials(Env("GTD_IT_STORAGE_KEY"), Env("GTD_IT_STORAGE_SECRET")),
            new AmazonS3Config { ServiceURL = Env("GTD_IT_STORAGE_URL"), ForcePathStyle = true, AuthenticationRegion = "us-east-1" });
        foreach (var key in Seed.StoredObjects)
            await s3.PutObjectAsync(new Amazon.S3.Model.PutObjectRequest { BucketName = "documents", Key = key, ContentBody = key });
    }

    /// <summary>A client without a session.</summary>
    public HttpClient Anonymous() => _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    /// <summary>A client signed in through /api/auth/login (session cookie), one per user and run.</summary>
    public async Task<HttpClient> As(string email)
    {
        if (_clients.TryGetValue(email, out var cached)) return cached;
        var client = await LoginAsync(email);
        _clients[email] = client;
        return client;
    }

    /// <summary>A fresh session, for tests that end it.</summary>
    public async Task<HttpClient> LoginAsync(string email)
    {
        var client = Anonymous();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Seed.Password });
        if (!res.IsSuccessStatusCode) throw new InvalidOperationException($"login {email}: {(int)res.StatusCode}");
        return client;
    }

    /// <summary>Single value from the test database as the owner (bypasses the API).</summary>
    public async Task<T?> ScalarAsync<T>(string sql, params object[] args)
    {
        await using var conn = new NpgsqlConnection(OwnerConnection);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var a in args) cmd.Parameters.Add(new NpgsqlParameter { Value = a });
        var v = await cmd.ExecuteScalarAsync();
        return v is null or DBNull ? default : (T)v;
    }

    public async Task ExecAsync(string sql, params object[] args)
    {
        await using var conn = new NpgsqlConnection(OwnerConnection);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var a in args) cmd.Parameters.Add(new NpgsqlParameter { Value = a });
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        foreach (var c in _clients.Values) c.Dispose();
        await _factory.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(Env("GTD_IT_DB"));
        await conn.OpenAsync();
        // Separate commands: DROP DATABASE cannot run in the implicit transaction of a multi-statement command.
        foreach (var sql in new[] { $"DROP DATABASE IF EXISTS \"{DbName}\" WITH (FORCE)", $"DROP ROLE IF EXISTS \"{AppRole}\"" })
        {
            await using var cmd = new NpgsqlCommand(sql, conn);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    // One API and database for all test classes; they run one after another.
    public const string Name = "api";
}
