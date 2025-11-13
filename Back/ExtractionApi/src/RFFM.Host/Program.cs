using RFFM.Host;
using RFFM.Host.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Host.AddSerilog(builder.Configuration);

var startup = new Startup(builder.Configuration);

startup.ConfigureServices(builder.Services);

var app = builder.Build();

startup.Configure(app, app.Environment);

//await app.MigrateDbContext<TodoDbContext>();
//await app.MigrateDbContext<IntegrationEventContext>();

app.Run();

