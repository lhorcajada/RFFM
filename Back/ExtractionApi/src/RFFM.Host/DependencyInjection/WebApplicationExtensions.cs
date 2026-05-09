using Npgsql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using RFFM.Api.Infrastructure.Persistence.Seed;

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
                catch (NpgsqlException npgsqlEx) when (npgsqlEx.IsTransient && attempt < maxRetries)
                {
                    logger.LogWarning(npgsqlEx, 
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

        public static async Task SeedFormationsAsync(this WebApplication app)
        {
            using var scope = app.Services.CreateScope();
            var logger = scope.ServiceProvider.GetService<ILogger<WebApplication>>();

            try
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                logger?.LogInformation("Seeding formations if not present...");
                await RFFM.Api.Infrastructure.Persistence.Seed.FormationsSeeder.SeedAsync(db);
                logger?.LogInformation("\u2713 Formations seeding finished");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error while seeding formations");
            }
        }

        public static async Task SeedClubKitsAsync(this WebApplication app)
        {
            using var scope = app.Services.CreateScope();
            var logger = scope.ServiceProvider.GetService<ILogger<WebApplication>>();

            try
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                logger?.LogInformation("Seeding club kits if not present...");
                await RFFM.Api.Infrastructure.Persistence.Seed.ClubKitsSeeder.SeedAsync(db, logger);
                logger?.LogInformation("\u2713 Club kits seeding finished");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error while seeding club kits");
            }
        }

        public static async Task SeedPaymentPlansAsync(this WebApplication app)
        {
            using var scope = app.Services.CreateScope();
            var logger = scope.ServiceProvider.GetService<ILogger<WebApplication>>();

            try
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                logger?.LogInformation("Seeding payment plans if not present...");
                await PaymentPlansSeeder.SeedAsync(db);
                logger?.LogInformation("✓ Payment plans seeding finished");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error while seeding payment plans");
            }
        }

        public static async Task SeedPermissionsAsync(this WebApplication app)
        {
            using var scope = app.Services.CreateScope();
            var logger = scope.ServiceProvider.GetService<ILogger<WebApplication>>();

            try
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var roleManager = scope.ServiceProvider.GetService<RoleManager<IdentityRole>>();

                logger?.LogInformation("Seeding new identity roles if not present...");
                string[] newRoles = ["ClubDirector", "Player", "FamilyMember", "Fan", "ClubMember"];
                if (roleManager != null)
                {
                    foreach (var roleName in newRoles)
                    {
                        if (!await roleManager.RoleExistsAsync(roleName))
                        {
                            var result = await roleManager.CreateAsync(new IdentityRole(roleName));
                            if (result.Succeeded)
                                logger?.LogInformation("Created role {Role}", roleName);
                            else
                                logger?.LogWarning("Failed to create role {Role}: {Errors}",
                                    roleName, string.Join(',', result.Errors.Select(e => e.Description)));
                        }
                    }
                }

                logger?.LogInformation("Seeding feature permissions if not present...");
                await SeedFeaturePermissionsAsync(db, logger);

                logger?.LogInformation("Seeding page permissions if not present...");
                await SeedPagePermissionsAsync(db, logger);

                logger?.LogInformation("✓ Permissions seeding finished");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error while seeding permissions");
            }
        }

        private static async Task SeedFeaturePermissionsAsync(AppDbContext db, ILogger? logger)
        {
            var strategy = db.Database.CreateExecutionStrategy();

            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await db.Database.BeginTransactionAsync();

                try
                {
                    var entries = new[]
                    {
                        // Coach
                        ("SeasonPrep",   "/coach/season-prep",   "Coach",       3, false),
                        ("Roster",        "/coach/roster",        "Coach",       3, false),
                        ("Trainings",     "/coach/trainings",     "Coach",       3, false),
                        ("GameModels",    "/coach/game-models",   "Coach",       3, false),
                        ("Assistances",   "/coach/assistances",   "Coach",       3, false),
                        ("Convocations",  "/coach/convocations",  "Coach",       3, false),
                        ("Dashboard",     "/coach/dashboard",     "Coach",       1, false),

                        // ClubDirector
                        ("Dashboard",     "/coach/dashboard",     "ClubDirector", 1, true),
                        ("Roster",        "/coach/roster",        "ClubDirector", 1, true),

                        // Player
                        ("Dashboard",     "/coach/dashboard",     "Player",      1, false),
                        ("Roster",        "/coach/roster",        "Player",      1, false),

                        // FamilyMember
                        ("Dashboard",     "/coach/dashboard",     "FamilyMember", 1, false),
                        ("Roster",        "/coach/roster",        "FamilyMember", 1, false),

                        // Fan
                        ("Dashboard",     "/coach/dashboard",     "Fan",         1, false),

                        // ClubMember
                        ("Dashboard",     "/coach/dashboard",     "ClubMember",  1, false),
                        ("Roster",        "/coach/roster",        "ClubMember",  1, false),
                    };

                    foreach (var (featureName, featureRoute, roleName, permTypeId, isEditable) in entries)
                    {
                        var exists = db.FeaturePermissions.Any(
                            fp => fp.RoleName == roleName && fp.FeatureRoute == featureRoute);
                        if (!exists)
                        {
                            db.FeaturePermissions.Add(new RFFM.Api.Domain.Entities.FeaturePermission(
                                featureName, featureRoute, roleName,
                                RFFM.Api.Domain.Entities.PermissionType.FromId(permTypeId),
                                isEditable));
                            logger?.LogDebug("Seeded FeaturePermission {Role} -> {Route}", roleName, featureRoute);
                        }
                    }

                    await db.SaveChangesAsync();
                    await tx.CommitAsync();
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            });
        }

        private static async Task SeedPagePermissionsAsync(AppDbContext db, ILogger? logger)
        {
            var strategy = db.Database.CreateExecutionStrategy();

            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await db.Database.BeginTransactionAsync();

                try
                {
                    var entries = new[]
                    {
                        // Roster page
                        ("Roster", "view_all_ratings",  "Coach",       1, false),
                        ("Roster", "edit_ratings",       "Coach",       3, false),
                        ("Roster", "view_own_rating",    "Player",      1, false),
                        ("Roster", "view_all_ratings",   "ClubDirector", 1, true),
                        ("Roster", "view_own_rating",    "FamilyMember", 1, false),
                    };

                    foreach (var (pageId, key, roleName, permTypeId, isEditable) in entries)
                    {
                        var exists = db.PagePermissions.Any(
                            pp => pp.RoleName == roleName && pp.PageIdentifier == pageId && pp.PermissionKey == key);
                        if (!exists)
                        {
                            db.PagePermissions.Add(new RFFM.Api.Domain.Entities.PagePermission(
                                pageId, key, roleName,
                                RFFM.Api.Domain.Entities.PermissionType.FromId(permTypeId),
                                isEditable));
                            logger?.LogDebug("Seeded PagePermission {Role} -> {Page}.{Key}", roleName, pageId, key);
                        }
                    }

                    await db.SaveChangesAsync();
                    await tx.CommitAsync();
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            });
        }
    }
}
