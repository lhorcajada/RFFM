using System.Data.Common;
using Microsoft.EntityFrameworkCore;

namespace RFFM.Api.Infrastructure.Persistence
{
    public sealed class ReadOnlyCatalogDbContext : AppDbContext
    {
        public ReadOnlyCatalogDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
            ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
        }

    }
}
