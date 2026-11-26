#nullable enable
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    public class ClubFilterWiringTests
    {
        private static ServiceProvider BuildProvider(string? userId)
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql("Host=localhost;Database=wiring_unused;Username=test;Password=test"));
            services.AddScoped<ICurrentUserService>(_ => new FixedCurrentUserService(userId));
            return services.BuildServiceProvider();
        }

        [Fact]
        public void Authenticated_user_resolves_user_aware_context_with_filter_active()
        {
            using var provider = BuildProvider("u1");
            using var scope = provider.CreateScope();

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            Assert.True(db.ClubFilterActive);
            Assert.Equal("u1", db.CurrentUserId);
        }

        [Fact]
        public void Anonymous_user_resolves_context_with_filter_inactive()
        {
            using var provider = BuildProvider(null);
            using var scope = provider.CreateScope();

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            Assert.False(db.ClubFilterActive);
            Assert.Null(db.CurrentUserId);
        }
    }
}
