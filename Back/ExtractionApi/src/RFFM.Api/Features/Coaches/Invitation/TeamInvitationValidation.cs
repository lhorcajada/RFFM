using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation
{
    public static class TeamInvitationValidation
    {
        public sealed record Result
        {
            public Team? Team { get; init; }
            public Membership? Membership { get; init; }
            public bool Success => Team is not null && ErrorCode is null;
            public int? StatusCode { get; init; }
            public string? ErrorCode { get; init; }
            public string? Title { get; init; }
            public string? Detail { get; init; }
        }

        // Team-code path keeps rejecting Coach/Directive/ClubMember — unchanged
        // from today's behavior (only the club-code path lifts the Coach
        // restriction, per design.md §1).
        public static async Task<Result> Validate(
            AppDbContext db, string? code, Membership requestedKind, CancellationToken cancellationToken)
        {
            if (requestedKind.Key == Membership.Coach.Key
                || requestedKind.Key == Membership.Directive.Key
                || requestedKind.Key == Membership.ClubMember.Key)
            {
                return new Result
                {
                    StatusCode = 400,
                    ErrorCode = ErrorCodes.TeamInvitationCodeNotAllowedForRole,
                    Title = "Membership no permitida",
                    Detail = "El rol indicado no aplica a un equipo. Use Player o FamilyPlayer."
                };
            }

            var normalizedCode = (code ?? string.Empty).Trim().ToUpperInvariant();
            var team = await db.Teams
                .FirstOrDefaultAsync(t => t.JoinCode != null
                                           && t.JoinCode.ToUpper() == normalizedCode,
                    cancellationToken);

            if (team is null)
            {
                return new Result
                {
                    StatusCode = 404,
                    ErrorCode = ErrorCodes.TeamInvitationCodeInvalid,
                    Title = "Código inexistente",
                    Detail = "El código de invitación no corresponde a ningún equipo."
                };
            }

            return new Result { Team = team, Membership = requestedKind };
        }
    }
}
