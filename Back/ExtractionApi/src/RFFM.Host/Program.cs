using RFFM.Host;
using RFFM.Host.DependencyInjection;
using RFFM.Api.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Host.AddSerilog(builder.Configuration);

var startup = new Startup(builder.Configuration);

startup.ConfigureServices(builder.Services);

var app = builder.Build();

startup.Configure(app, app.Environment);

// Apply database migrations automatically
await app.MigrateDbContext<AppDbContext>();
await app.MigrateDbContext<IdentityDbContext>();

// Seed roles/claims asynchronously (non-blocking)
app.SeedIdentityRoles();

// Seed payment plans
await app.SeedPaymentPlansAsync();

app.Run();

