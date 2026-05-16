using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RFFM.Api.Infrastructure.Persistence;

public class IdentityDbContextDesignTimeFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var configuration = DesignTimeDbContextConfiguration.BuildConfiguration();
        var connectionString = DesignTimeDbContextConfiguration.ResolveConnectionString(configuration, "IdentityConnection", args);

        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "identity"))
            .Options;

        return new IdentityDbContext(options);
    }
}
