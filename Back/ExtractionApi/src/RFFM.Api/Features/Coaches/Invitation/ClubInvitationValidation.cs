using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation
{
    public static class ClubInvitationValidation
    {
        public sealed record Result
        {
            public Club? Club { get; init; }
            public Membership? Membership { get; init; }
            public bool Success => Club is not null && ErrorCode is null;
            public int? StatusCode { get; init; }
            public string? ErrorCode { get; init; }
            public string? Title { get; init; }
            public string? Detail { get; init; }
        }

        // requestedKind: the Membership the caller is trying to register/join as.
        // Directive can never join via club code (unchanged pre-existing rule).
        // Coach IS allowed here (restriction lifted per design.md §1) — the
        // team-code path (TeamInvitationValidation) still rejects Coach.
        public static async Task<Result> Validate(
            AppDbContext db, string? code, Membership requestedKind, CancellationToken cancellationToken)
        {
            if (requestedKind.Key == Membership.Directive.Key)
            {
                return new Result
                {
                    StatusCode = 400,
                    ErrorCode = ErrorCodes.ClubInvitationCodeNotAllowedForRole,
                    Title = "Membership no permitida",
                    Detail = "El rol Directive no se une mediante código de invitación."
                };
            }

            var normalizedCode = (code ?? string.Empty).Trim().ToUpperInvariant();
            var club = await db.Clubs
                .FirstOrDefaultAsync(c => c.InvitationCode != null
                                          && c.InvitationCode.ToUpper() == normalizedCode,
                    cancellationToken);

            if (club is null)
            {
                return new Result
                {
                    StatusCode = 404,
                    ErrorCode = ErrorCodes.ClubInvitationCodeInvalid,
                    Title = "Código inexistente",
                    Detail = "El código de invitación no corresponde a ningún club."
                };
            }

            return new Result { Club = club, Membership = requestedKind };
        }
    }
}
