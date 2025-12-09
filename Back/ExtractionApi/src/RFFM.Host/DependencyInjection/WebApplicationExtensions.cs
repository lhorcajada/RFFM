using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Host.DependencyInjection
{
    internal static class WebApplicationExtensions
    {
        public static async Task MigrateDbContext<TContext>(this WebApplication webApplication)
            where TContext : DbContext
        {
            var scopeFactory = webApplication.Services.GetRequiredService<IServiceScopeFactory>();
            var logger = webApplication.Services.GetRequiredService<ILogger<WebApplication>>();

            using var scope = scopeFactory.CreateScope();
            
            var db = scope.ServiceProvider.GetRequiredService<TContext>();

            try
            {
                logger.LogInformation("Applying migrations for {Context}...", typeof(TContext).Name);
                
                // Verificar si la base de datos existe
                var canConnect = await db.Database.CanConnectAsync();
                var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
                
                if (!canConnect || pendingMigrations.Any())
                {
                    logger.LogInformation("Database status - CanConnect: {CanConnect}, PendingMigrations: {Count}", 
                        canConnect, pendingMigrations.Count());
                    
                    if (pendingMigrations.Any())
                    {
                        logger.LogInformation("Pending migrations: {Migrations}", 
                            string.Join(", ", pendingMigrations));
                    }
                }
                
                await db.Database.MigrateAsync();
                logger.LogInformation("✓ Migrations applied successfully for {Context}", typeof(TContext).Name);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("pending changes"))
            {
                logger.LogWarning("⚠️ {Context} has pending model changes.", typeof(TContext).Name);
                logger.LogWarning("This usually happens when the model was modified but no migration was created.");
                logger.LogWarning("To fix this, create a new migration:");
                logger.LogWarning("   .\\manage-migrations.ps1 -Action create -MigrationName \"SyncPendingChanges\" -Context {Context}", 
                    typeof(TContext).Name);
                
                // Si la base de datos no existe, intentar crearla de todas formas
                var canConnect = await db.Database.CanConnectAsync();
                if (!canConnect)
                {
                    logger.LogWarning("Database does not exist. Creating from scratch...");
                    try
                    {
                        await db.Database.EnsureCreatedAsync();
                        logger.LogInformation("✓ Database created successfully");
                        return;
                    }
                    catch (Exception createEx)
                    {
                        logger.LogError(createEx, "❌ Failed to create database");
                    }
                }
                
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Error applying migrations for {Context}", typeof(TContext).Name);
                throw;
            }
        }
    }
}
