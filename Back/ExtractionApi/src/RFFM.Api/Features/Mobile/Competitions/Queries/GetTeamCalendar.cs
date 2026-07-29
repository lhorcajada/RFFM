using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Infrastructure.Persistence;
using System.Globalization;

namespace RFFM.Api.Features.Mobile.Competitions.Queries
{
    /// <summary>
    /// Returns the full matchday-by-matchday calendar (including finished match results) for
    /// the requested team's own RFFM competition/group. If the team is not yet associated with
    /// a competition, returns an explicit empty calendar instead of calling the scrape.
    /// </summary>
    public class GetTeamCalendar : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/mobile/teams/{teamId}/calendar",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new MobileCalendarQuery { TeamId = teamId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamCalendar))
                .WithTags("Mobile")
                .Produces<MobileCalendarDto>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record MobileCalendarQuery : IQueryApp<MobileCalendarDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.CompetitionData;
            public string RequiredPermission => "Read";
        }

        public record MobileCalendarDto(List<MobileCalendarMatchDayDto> MatchDays);

        public record MobileCalendarMatchDayDto(DateTime Date, int MatchDayNumber, List<MobileMatchDto> Matches);

        public record MobileMatchDto(
            DateTime Date,
            string Time,
            string LocalTeamName,
            string LocalTeamImageUrl,
            int? LocalGoals,
            string VisitorTeamName,
            string VisitorTeamImageUrl,
            int? VisitorGoals,
            string Status);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db, ICalendarService calendarService)
            : IRequestHandler<MobileCalendarQuery, MobileCalendarDto>
        {
            public async ValueTask<MobileCalendarDto> Handle(MobileCalendarQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new DomainException("Equipo", "Equipo no encontrado", "TeamNotFound");

                if (team.RffmCompetitionId == null || team.RffmGroupId == null)
                    return new MobileCalendarDto([]);

                var calendar = await calendarService.GetCalendarAsync(
                    team.RffmCompetitionId.Value, team.RffmGroupId.Value, cancellationToken);

                return new MobileCalendarDto(calendar.MatchDays.Select(ToDto).ToList());
            }

            internal static MobileCalendarMatchDayDto ToDto(CalendarMatchDayResponse matchDay)
                => new(
                    matchDay.Date,
                    matchDay.MatchDayNumber,
                    matchDay.Matches.Select(ToDto).ToList());

            /// <summary>
            /// RFFM's scraped calendar returns goals as an empty string when the match hasn't
            /// been played yet. Parsing to a nullable int (rather than defaulting to 0) lets
            /// Mobile distinguish a genuine 0-0 result from "not played".
            /// </summary>
            internal static MobileMatchDto ToDto(MatchResponse match)
                => new(
                    match.Date,
                    match.Time,
                    match.LocalTeamName,
                    match.LocalTeamImageUrl,
                    ParseNullableInt(match.LocalGoals),
                    match.VisitorTeamName,
                    match.VisitorTeamImageUrl,
                    ParseNullableInt(match.VisitorGoals),
                    match.Status);

            internal static int? ParseNullableInt(string? value)
                => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
        }
    }
}
