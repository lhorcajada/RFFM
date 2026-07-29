using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.Competitions.Queries
{
    /// <summary>
    /// Returns the requested team's next unplayed fixture, derived from the same calendar data
    /// as GetTeamCalendar (no second scrape). "Unplayed" is defined here as: scheduled on or
    /// after today, and not already carrying both a local and visitor goal count. This
    /// predicate has not been verified against a live/edge-case RFFM scrape (e.g. suspended or
    /// rescheduled matches) — see design.md's Open Questions for mobile-league-standings-calendar.
    /// </summary>
    public class GetTeamNextMatch : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/mobile/teams/{teamId}/next-match",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new MobileNextMatchQuery { TeamId = teamId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamNextMatch))
                .WithTags("Mobile")
                .Produces<MobileNextMatchDto>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record MobileNextMatchQuery : IQueryApp<MobileNextMatchDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.CompetitionData;
            public string RequiredPermission => "Read";
        }

        public record MobileNextMatchDto(GetTeamCalendar.MobileMatchDto? Match);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db, ICalendarService calendarService)
            : IRequestHandler<MobileNextMatchQuery, MobileNextMatchDto>
        {
            public async ValueTask<MobileNextMatchDto> Handle(MobileNextMatchQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new DomainException("Equipo", "Equipo no encontrado", "TeamNotFound");

                if (team.RffmCompetitionId == null || team.RffmGroupId == null)
                    return new MobileNextMatchDto(null);

                var calendar = await calendarService.GetCalendarAsync(
                    team.RffmCompetitionId.Value, team.RffmGroupId.Value, cancellationToken);

                var today = DateTime.UtcNow.Date;

                var nextMatch = calendar.MatchDays
                    .SelectMany(md => md.Matches)
                    .Where(m => m.Date.Date >= today && !IsPlayed(m))
                    .OrderBy(m => m.Date)
                    .ThenBy(m => ParseTimeOrDefault(m.Time))
                    .FirstOrDefault();

                if (nextMatch == null)
                    return new MobileNextMatchDto(null);

                return new MobileNextMatchDto(GetTeamCalendar.Handler.ToDto(nextMatch));
            }

            private static bool IsPlayed(Federation.Competitions.Queries.GetCalendar.Responses.MatchResponse match)
                => GetTeamCalendar.Handler.ParseNullableInt(match.LocalGoals) != null
                   && GetTeamCalendar.Handler.ParseNullableInt(match.VisitorGoals) != null;

            private static TimeSpan ParseTimeOrDefault(string? time)
                => TimeSpan.TryParse(time, out var parsed) ? parsed : TimeSpan.Zero;
        }
    }
}
