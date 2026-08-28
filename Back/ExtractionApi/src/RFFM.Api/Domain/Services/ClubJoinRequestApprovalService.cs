using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Domain.Services
{
    public class ClubJoinRequestApprovalService : IClubJoinRequestApprovalService
    {
        private readonly AppDbContext _db;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IClubSeatBillingService _billing;
        private readonly ILogger<ClubJoinRequestApprovalService> _logger;

        public ClubJoinRequestApprovalService(
            AppDbContext db, UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager,
            IClubSeatBillingService billing, ILogger<ClubJoinRequestApprovalService> logger)
        {
            _db = db;
            _userManager = userManager;
            _roleManager = roleManager;
            _billing = billing;
            _logger = logger;
        }

        public async Task ApproveAsync(ClubJoinRequest joinRequest, string decidedByUserId, CancellationToken cancellationToken)
        {
            // NOTE on atomicity: Identity (UserManager/RoleManager) lives in a separate
            // DbContext/connection (IdentityDbContext) from the ClubJoinRequest/UserClub rows
            // (AppDbContext). A System.Transactions.TransactionScope spanning both is
            // incompatible with AppDbContext's EnableRetryOnFailure execution strategy (EF Core
            // throws as soon as any command runs under one) and never gave genuine two-connection
            // atomicity to begin with (Npgsql does not support promoting to a real distributed
            // transaction). Use the execution-strategy-aware transaction API for the AppDbContext
            // writes, and treat Identity role assignment as a best-effort step afterwards
            // (consistent with CreateUser.Handler.EnsureIdentityRoleAsync).
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                // joinRequest may already be tracked (loaded earlier by the caller); re-attach it
                // as Unchanged on every attempt (including retries) BEFORE mutating it, so EF
                // Core's change tracker snapshots the pre-approval state and detects the mutation
                // below as a real change. Clearing the tracker (instead of just re-attaching)
                // would make Approve()'s in-memory mutation invisible to SaveChangesAsync if it
                // ran before Attach.
                _db.ChangeTracker.Clear();
                _db.ClubJoinRequests.Attach(joinRequest);

                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                joinRequest.Approve(decidedByUserId);

                var existingUserClub = await _db.UserClubs.SingleOrDefaultAsync(
                    uc => uc.ApplicationUserId == joinRequest.ApplicationUserId && uc.ClubId == joinRequest.ClubId,
                    cancellationToken);
                if (existingUserClub is not null)
                    existingUserClub.UpdateRoleId(joinRequest.MembershipId);
                else
                    _db.UserClubs.Add(new UserClub(joinRequest.ApplicationUserId, joinRequest.ClubId, joinRequest.MembershipId));

                await _db.SaveChangesAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);
            });

            try
            {
                var user = await _userManager.FindByIdAsync(joinRequest.ApplicationUserId);
                if (user is not null)
                {
                    if (!await _roleManager.RoleExistsAsync(AppRoles.Coach.Name))
                        await _roleManager.CreateAsync(new IdentityRole(AppRoles.Coach.Name));
                    if (!await _userManager.IsInRoleAsync(user, AppRoles.Coach.Name))
                        await _userManager.AddToRoleAsync(user, AppRoles.Coach.Name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ClubJoinRequestApprovalService: could not assign Coach role for request {RequestId}", joinRequest.Id);
            }

            try
            {
                await _billing.ChargeSeatAsync(joinRequest.ClubId, joinRequest.ApplicationUserId, joinRequest.MembershipId, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ClubJoinRequestApprovalService: billing hook failed for request {RequestId}", joinRequest.Id);
            }
        }
    }
}
