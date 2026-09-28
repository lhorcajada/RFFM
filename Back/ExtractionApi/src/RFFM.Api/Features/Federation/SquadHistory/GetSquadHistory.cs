using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.SquadHistory
{
    /// <summary>
    /// GET /teams/{teamCode}/squad-history?seasonId= — historial persistido de la plantilla.
    /// IRequest (no IQueryApp): el estado cambia mientras se genera y no debe cachearse.
    /// </summary>
    public class GetSquadHistory : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamCode}/squad-history",
                    async (string teamCode, int seasonId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetSquadHistoryQuery(teamCode, seasonId), cancellationToken);
                        return result is null
                            ? Results.Problem(
                                title: "Historial no encontrado",
                                detail: "Todavía no se ha generado el historial de esta plantilla.",
                                statusCode: StatusCodes.Status404NotFound)
                            : Results.Ok(result);
                    })
                .WithName(nameof(GetSquadHistory))
                .WithTags(SquadHistoryConstants.SquadHistoryFeature)
                .Produces<SquadHistoryResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record GetSquadHistoryQuery(string TeamCode, int SeasonId) : IRequest<SquadHistoryResponse?>;

        public record SquadHistoryResponse(
            string ReportId, string TeamCode, string TeamName, int SeasonId, int? PreviousSeasonId,
            string Status, int TotalPlayers, int ProcessedPlayers, int FailedPlayers,
            DateTime RequestedAt, DateTime? CompletedAt, string? ErrorMessage,
            bool IsCandidateSquad, string? CandidateSearchNote,
            List<SquadHistoryPlayerResponse> Players);

        public record SquadHistoryPlayerResponse(string PlayerCode, string PlayerName, int? BirthYear, string? OriginTeamName,
            bool IsIncomplete, List<SquadHistorySeasonResponse> Seasons);

        public record SquadHistorySeasonResponse(int SeasonId, string SeasonName, List<SquadHistoryTeamResponse> Teams);

        public record SquadHistoryTeamResponse(
            string CompetitionCode, string CompetitionName, string GroupCode, string GroupName,
            string TeamCode, string TeamName, string ClubName, string? TeamShieldUrl,
            int TeamPoints, int TeamPosition, int Goals, int YellowCards, int RedCards,
            int? Starts, int? CallUps, string Source, bool IsIncomplete);

        public class Handler(FederationDbContext db) : IRequestHandler<GetSquadHistoryQuery, SquadHistoryResponse?>
        {
            public async ValueTask<SquadHistoryResponse?> Handle(GetSquadHistoryQuery request, CancellationToken cancellationToken)
            {
                var teamCode = request.TeamCode.Trim();
                var report = await db.SquadHistoryReports
                    .AsNoTracking()
                    .Include(r => r.Entries)
                    .SingleOrDefaultAsync(r => r.TeamCode == teamCode && r.SeasonId == request.SeasonId, cancellationToken);

                if (report is null) return null;

                var players = report.Entries
                    .GroupBy(e => e.PlayerCode)
                    .Select(player => new SquadHistoryPlayerResponse(
                        player.Key,
                        player.First().PlayerName,
                        player.Select(e => e.BirthYear).FirstOrDefault(y => y.HasValue),
                        player.Select(e => e.OriginTeamName).FirstOrDefault(o => !string.IsNullOrEmpty(o)),
                        player.Any(e => e.IsIncomplete),
                        player
                            .GroupBy(e => new { e.SeasonId, e.SeasonName })
                            .OrderByDescending(s => s.Key.SeasonId)
                            .Select(season => new SquadHistorySeasonResponse(
                                season.Key.SeasonId,
                                season.Key.SeasonName,
                                season
                                    .Where(e => !string.IsNullOrEmpty(e.TeamCode) || e.IsIncomplete)
                                    .OrderBy(e => e.TeamName)
                                    .Select(e => new SquadHistoryTeamResponse(
                                        e.CompetitionCode, e.CompetitionName, e.GroupCode, e.GroupName,
                                        e.TeamCode, e.TeamName, e.ClubName, e.TeamShieldUrl,
                                        e.TeamPoints, e.TeamPosition, e.Goals, e.YellowCards, e.RedCards,
                                        e.Starts, e.CallUps, e.Source.Name, e.IsIncomplete))
                                    .ToList()))
                            .ToList()))
                    .OrderBy(p => p.PlayerName, StringComparer.CurrentCultureIgnoreCase)
                    .ToList();

                return new SquadHistoryResponse(
                    report.Id, report.TeamCode, report.TeamName, report.SeasonId, report.PreviousSeasonId,
                    report.Status.Name, report.TotalPlayers, report.ProcessedPlayers, report.FailedPlayers,
                    report.RequestedAt, report.CompletedAt, report.ErrorMessage,
                    report.IsCandidateSquad, report.CandidateSearchNote, players);
            }
        }
    }
}
