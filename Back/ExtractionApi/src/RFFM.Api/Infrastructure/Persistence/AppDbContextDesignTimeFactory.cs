using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RFFM.Api.Infrastructure.Persistence;

public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=localhost;Port=5433;Database=futbolbase;Username=rffm_coaches;Password=rffm_coaches_dev_2024",
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app"))
            .Options;

        return new AppDbContext(options);
    }
}
