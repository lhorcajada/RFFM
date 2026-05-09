using Microsoft.EntityFrameworkCore;

namespace RFFM.Api.Infrastructure.Persistence;

public class IdentityDbContext : Microsoft.AspNetCore.Identity.EntityFrameworkCore.IdentityDbContext
{
    public IdentityDbContext(DbContextOptions<IdentityDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.HasDefaultSchema("identity");
    }

    // Note: PaymentPlan and Subscription are part of the application domain and are mapped in AppDbContext.
}