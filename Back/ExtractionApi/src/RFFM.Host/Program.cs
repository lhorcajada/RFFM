using RFFM.Host;
using RFFM.Host.DependencyInjection;
using RFFM.Api.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Configure QuestPDF license type for runtime. Set to Community for free usage.
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

builder.Host.AddSerilog(builder.Configuration);

var startup = new Startup(builder.Configuration, builder.Environment);

startup.ConfigureServices(builder.Services);

var app = builder.Build();

startup.Configure(app, app.Environment);

// Apply database migrations automatically on startup.
await app.MigrateDbContext<AppDbContext>();
await app.MigrateDbContext<IdentityDbContext>();

// FederationDbContext usa PostgreSQL externo (Supabase) — no debe crashear el app si falla
try
{
    await app.MigrateDbContext<FederationDbContext>();
}
catch (Exception ex)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogWarning(ex, "⚠️ FederationDbContext migration failed. Recheck FederationConnection string (SSL required for Supabase).");
}

// Seed roles/claims asynchronously (non-blocking)
app.SeedIdentityRoles();

// Seed payment plans
await app.SeedPaymentPlansAsync();

// Seed formations catalog
await app.SeedFormationsAsync();

// Seed club kits
await app.SeedClubKitsAsync();

// Seed exercise types catalog
await app.SeedExerciseTypesAsync();

// Seed new roles and feature/page permissions
await app.SeedPermissionsAsync();

app.Run();

