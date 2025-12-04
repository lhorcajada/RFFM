using System.Data.Common;
using Microsoft.EntityFrameworkCore;

namespace RFFM.Api.Infrastructure.Persistence
{
    public sealed class ReadOnlyCatalogDbContext : AppDbContext
    {
        public ReadOnlyCatalogDbContext(DbConnection connection) : base(connection)
        {
            ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
        }

    }
}
