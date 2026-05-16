using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RFFM.Api.Infrastructure.Persistence;

public class FederationDbContextDesignTimeFactory : IDesignTimeDbContextFactory<FederationDbContext>
{
    public FederationDbContext CreateDbContext(string[] args)
    {
        var configuration = DesignTimeDbContextConfiguration.BuildConfiguration();
        var connectionString = DesignTimeDbContextConfiguration.ResolveConnectionString(configuration, "FederationConnection", args);

        var options = new DbContextOptionsBuilder<FederationDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation"))
            .Options;

        return new FederationDbContext(options);
    }
}
