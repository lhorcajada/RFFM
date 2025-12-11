using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;

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

            var maxRetries = 3;
            var retryDelay = TimeSpan.FromSeconds(5);

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    logger.LogInformation("Applying migrations for {Context}... (Attempt {Attempt}/{MaxRetries})", 
                        typeof(TContext).Name, attempt, maxRetries);
                    
                    // Verificar si la base de datos existe
                    var canConnect = await db.Database.CanConnectAsync();
                    var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
                    
                    if (!canConnect)
                    {
                        logger.LogWarning("Cannot connect to database. It may not exist yet.");
                    }
                    
                    if (pendingMigrations.Any())
                    {
                        logger.LogInformation("Database status - CanConnect: {CanConnect}, PendingMigrations: {Count}", 
                            canConnect, pendingMigrations.Count());
                        logger.LogInformation("Pending migrations: {Migrations}", 
                            string.Join(", ", pendingMigrations));
                    }
                    else if (canConnect)
                    {
                        logger.LogInformation("No pending migrations. Database is up to date.");
                    }
                    
                    await db.Database.MigrateAsync();
                    logger.LogInformation("✓ Migrations applied successfully for {Context}", typeof(TContext).Name);
                    return; // Success, exit retry loop
                }
                catch (SqlException sqlEx) when (IsTransientError(sqlEx) && attempt < maxRetries)
                {
                    logger.LogWarning(sqlEx, 
                        "Transient SQL error on attempt {Attempt}/{MaxRetries}. Retrying in {Delay} seconds...", 
                        attempt, maxRetries, retryDelay.TotalSeconds);
                    await Task.Delay(retryDelay);
                    retryDelay = TimeSpan.FromSeconds(retryDelay.TotalSeconds * 2); // Exponential backoff
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
                catch (Exception ex) when (attempt < maxRetries)
                {
                    logger.LogError(ex, "❌ Error applying migrations for {Context} (Attempt {Attempt}/{MaxRetries})", 
                        typeof(TContext).Name, attempt, maxRetries);
                    
                    if (attempt < maxRetries)
                    {
                        logger.LogInformation("Retrying in {Delay} seconds...", retryDelay.TotalSeconds);
                        await Task.Delay(retryDelay);
                        retryDelay = TimeSpan.FromSeconds(retryDelay.TotalSeconds * 2);
                    }
                    else
                    {
                        throw;
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "❌ Fatal error applying migrations for {Context}. All retries exhausted.", 
                        typeof(TContext).Name);
                    throw;
                }
            }
        }

        private static bool IsTransientError(SqlException exception)
        {
            // Códigos de error transitorios comunes en Azure SQL
            int[] transientErrorNumbers = new[]
            {
                4060,  // Cannot open database
                40197, // Service encountered an error processing your request
                40501, // The service is currently busy
                40613, // Database unavailable
                49918, // Cannot process request
                49919, // Cannot process create or update request
                49920, // Cannot process request
                4221,  // Read-Only Routing
                -2,    // Timeout
                -1,    // Connection broken
                2,     // Network error
                53,    // Network path not found
                64,    // SQL Server doesn't exist or access denied
                233,   // Connection initialization error
                10053, // Transport-level error
                10054, // Connection forcibly closed
                10060, // Network timeout
                10061, // Connection refused
                40143, // Connection could not be initialized
                40540, // Service has encountered an error processing your request
                40544, // The database has reached its size quota
                40549, // Session is terminated because of a long-running transaction
                40550, // Session terminated due to excessive lock acquisition
                40551, // Session terminated due to excessive TEMPDB usage
                40552, // Session terminated due to excessive transaction log space usage
                40553  // Session terminated due to excessive memory usage
            };

            return transientErrorNumbers.Contains(exception.Number);
        }

        public static void SeedIdentityRoles(this WebApplication app)
        {
            // Fire-and-forget seeding to avoid blocking startup. Exceptions are logged.
            _ = Task.Run(async () =>
            {
                using var scope = app.Services.CreateScope();
                var logger = scope.ServiceProvider.GetService<ILogger<WebApplication>>();

                try
                {
                    var roleManager = scope.ServiceProvider.GetService<RoleManager<IdentityRole>>();
                    var userManager = scope.ServiceProvider.GetService<UserManager<IdentityUser>>();

                    if (roleManager == null)
                    {
                        logger?.LogWarning("RoleManager not registered; skipping role seeding.");
                        return;
                    }

                    string[] roles = new[] { "Federation", "Coach", "Administrator" };

                    foreach (var roleName in roles)
                    {
                        if (!await roleManager.RoleExistsAsync(roleName))
                        {
                            var role = new IdentityRole(roleName);
                            var res = await roleManager.CreateAsync(role);
                            if (res.Succeeded)
                                logger?.LogInformation("Created role {Role}", roleName);
                            else
                                logger?.LogWarning("Failed to create role {Role}: {Errors}", roleName, string.Join(',', res.Errors.Select(e => e.Description)));
                        }
                        else
                        {
                            logger?.LogDebug("Role {Role} already exists", roleName);
                        }
                    }

                    // Seed default role claims (permissions) - adjust as needed
                    var admin = await roleManager.FindByNameAsync("Administrator");
                    if (admin != null)
                    {
                        var claims = await roleManager.GetClaimsAsync(admin);
                        if (!claims.Any(c => c.Type == "permission" && c.Value == "admin:*"))
                        {
                            await roleManager.AddClaimAsync(admin, new Claim("permission", "admin:*"));
                            logger?.LogInformation("Added admin:* claim to Administrator role");
                        }
                    }

                    var federation = await roleManager.FindByNameAsync("Federation");
                    if (federation != null)
                    {
                        var claims = await roleManager.GetClaimsAsync(federation);
                        if (!claims.Any(c => c.Type == "permission" && c.Value == "settings.manage"))
                        {
                            await roleManager.AddClaimAsync(federation, new Claim("permission", "settings.manage"));
                            logger?.LogInformation("Added settings.manage claim to Federation role");
                        }
                    }

                    var coach = await roleManager.FindByNameAsync("Coach");
                    if (coach != null)
                    {
                        var claims = await roleManager.GetClaimsAsync(coach);
                        if (!claims.Any(c => c.Type == "permission" && c.Value == "coach:manage"))
                        {
                            await roleManager.AddClaimAsync(coach, new Claim("permission", "coach:manage"));
                            logger?.LogInformation("Added coach:manage claim to Coach role");
                        }
                    }

                    // Optionally assign an admin user from configuration
                    var config = app.Configuration;
                    var adminEmail = config["Seed:AdminEmail"]; // set in appsettings or user-secrets
                    if (!string.IsNullOrEmpty(adminEmail) && userManager != null)
                    {
                        var user = await userManager.FindByEmailAsync(adminEmail);
                        if (user != null)
                        {
                            var inRole = await userManager.IsInRoleAsync(user, "Administrator");
                            if (!inRole)
                            {
                                await userManager.AddToRoleAsync(user, "Administrator");
                                logger?.LogInformation("Assigned Administrator role to user {Email}", adminEmail);
                            }
                        }
                        else
                        {
                            logger?.LogWarning("Admin user with email {Email} not found; cannot assign Administrator role.", adminEmail);
                        }
                    }
                }
                catch (Exception ex)
                {
                    using var scope2 = app.Services.CreateScope();
                    var logger2 = scope2.ServiceProvider.GetService<ILogger<WebApplication>>();
                    logger2?.LogError(ex, "Error while seeding identity roles");
                }
            });
        }
    }
}
