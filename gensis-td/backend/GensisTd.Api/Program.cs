using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Endpoints;
using GensisTd.Api.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
// Enums serialize as their names (e.g. "Admin"), not numbers.
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings__Default is not set"), AppDbContext.MapEnums));

var authSection = builder.Configuration.GetSection("Auth");
builder.Services.Configure<AuthOptions>(authSection);
var jwtSecret = authSection["JwtSecret"];
if (string.IsNullOrEmpty(jwtSecret) || jwtSecret.Length < 32)
    throw new InvalidOperationException("Auth__JwtSecret must be at least 32 characters");

builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LoginThrottle>();

// The client IP comes from the nginx proxy (which takes it from Cloudflare's CF-Connecting-IP).
// Only trust X-Forwarded-For from private networks: the proxy container, never the internet.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    o.ForwardLimit = 1;
    o.KnownProxies.Clear();
    o.KnownIPNetworks.Clear();
    foreach (var net in new[] { "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8" })
        o.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(net));
});
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = true;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = TokenService.Issuer,
            ValidAudience = TokenService.Issuer,
            IssuerSigningKey = TokenService.SigningKey(jwtSecret),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
        // Browser sends the session as an httpOnly cookie, not an Authorization header.
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                ctx.Token ??= ctx.Request.Cookies[AuthOptions.CookieName];
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorizationBuilder().AddGensisPolicies();

builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.AddSingleton<StorageService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    // Npgsql caches database types on first connect; reload so enums created by the migration are known.
    var conn = (Npgsql.NpgsqlConnection)db.Database.GetDbConnection();
    await conn.OpenAsync();
    await conn.ReloadTypesAsync();
    await conn.CloseAsync();
    await AdminSeeder.SeedAsync(db, app.Configuration, app.Logger);
}
await app.Services.GetRequiredService<StorageService>().EnsureBucketsAsync(app.Logger);

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseForwardedHeaders();
app.UseAuthentication();
app.UseActor();
app.UseAuthorization();

app.MapGet("/api/health", async (AppDbContext db) =>
    await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));
app.MapAuthEndpoints();
app.MapCatalogEndpoints();
app.MapProjectEndpoints();
app.MapProjectWriteEndpoints();

app.Run();
