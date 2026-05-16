using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RFFM.Api.Infrastructure.Persistence;

public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var configuration = DesignTimeDbContextConfiguration.BuildConfiguration();
        var connectionString = DesignTimeDbContextConfiguration.ResolveConnectionString(configuration, "FutbolBaseConnection", args);

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app"))
            .Options;

        return new AppDbContext(options);
    }
}
