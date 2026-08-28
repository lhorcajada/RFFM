#nullable enable
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using RFFM.Host.DependencyInjection;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Regression test: FamilyMember users saw fewer dashboard options than Player users
    /// (missing Injured/Sanctions/Lottery/AttendanceSummary), because
    /// WebApplicationExtensions.SeedFeaturePermissionsAsync only seeded 4 of the 8 read-only
    /// routes for "FamilyMember" that it seeds for "Player". Both roles link to the same
    /// TeamPlayer and are meant to have identical read-only dashboard access.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class FeaturePermissionsSeedParityTests
    {
        private readonly PostgresContainerFixture _fixture;

        public FeaturePermissionsSeedParityTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task SeedPermissionsAsync_GivesFamilyMemberTheSameDashboardRoutesAsPlayer()
        {
            var builder = WebApplication.CreateBuilder();
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
            await using var app = builder.Build();

            await app.SeedPermissionsAsync();

            await using var db = _fixture.CreateDbContext();
            var playerRoutes = await db.FeaturePermissions
                .Where(fp => fp.RoleName == "Player")
                .Select(fp => fp.FeatureRoute)
                .ToListAsync();
            var familyMemberRoutes = await db.FeaturePermissions
                .Where(fp => fp.RoleName == "FamilyMember")
                .Select(fp => fp.FeatureRoute)
                .ToListAsync();

            foreach (var route in playerRoutes)
            {
                Assert.Contains(route, familyMemberRoutes);
            }
        }

        [Theory]
        [InlineData("Injured")]
        [InlineData("Sanctions")]
        [InlineData("Lottery")]
        [InlineData("AttendanceSummary")]
        public async Task SeedPermissionsAsync_GivesFamilyMemberAccessToRoute(string featureName)
        {
            var builder = WebApplication.CreateBuilder();
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
            await using var app = builder.Build();

            await app.SeedPermissionsAsync();

            await using var db = _fixture.CreateDbContext();
            var hasAccess = await db.FeaturePermissions.AnyAsync(fp =>
                fp.RoleName == "FamilyMember" && fp.FeatureName == featureName);

            Assert.True(hasAccess, $"FamilyMember should have a FeaturePermission row for '{featureName}', same as Player.");
        }
    }
}
