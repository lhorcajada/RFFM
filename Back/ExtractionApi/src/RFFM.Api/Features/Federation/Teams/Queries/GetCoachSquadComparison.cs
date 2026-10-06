using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetCoachSquadComparison : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamCode}/coach-squad-comparison",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken,
                        string teamCode, int season, int competition, int group) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var response = await mediator.Send(
                            new QueryApp(userId, teamCode, season, competition, group), cancellationToken);
                        return Results.Ok(response);
                    })
                .RequireAuthorization()
                .WithName(nameof(GetCoachSquadComparison))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<CoachSquadComparisonResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status401Unauthorized);
        }

        public record QueryApp(string UserId, string TeamCode, int SeasonId, int CompetitionId, int GroupId)
            : IRequest<CoachSquadComparisonResponse>;

        public record CoachSquadComparisonResponse(bool IsCoachTeam, string? TeamId, string? TeamName,
            IReadOnlyList<ComparedPlayer> Players)
        {
            public static readonly CoachSquadComparisonResponse NotCoachTeam = new(false, null, null, []);
        }

        public class Handler(
            AppDbContext db,
            FederationDbContext federationDb,
            ITeamService teamService,
            IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<QueryApp, CoachSquadComparisonResponse>
        {
            public async ValueTask<CoachSquadComparisonResponse> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                var startYear = SeasonStartYear(request.SeasonId);
                if (startYear is null)
                    return CoachSquadComparisonResponse.NotCoachTeam;

                // Team no guarda el código RFFM: el equipo RFFM propio es el que el usuario tiene guardado en su configuración de Federación.
                var isSavedRffmTeam = await federationDb.FederationSettings
                    .AsNoTracking()
                    .AnyAsync(s => s.UserId == request.UserId && s.TeamId == request.TeamCode, cancellationToken);
                if (!isSavedRffmTeam)
                    return CoachSquadComparisonResponse.NotCoachTeam;

                var managedClubIds = db.UserClubs
                    .Where(uc => uc.ApplicationUserId == request.UserId
                                 && (uc.RoleId == Membership.Directive.Id || uc.RoleId == Membership.Coach.Id))
                    .Select(uc => uc.ClubId);
                var coachedTeamIds = db.UserTeams
                    .Where(ut => ut.ApplicationUserId == request.UserId && ut.RoleId == Membership.Coach.Id)
                    .Select(ut => ut.TeamId);

                var teams = await db.Teams
                    .AsNoTracking()
                    .Where(t => t.RffmCompetitionId == request.CompetitionId
                                && t.RffmGroupId == request.GroupId
                                && t.Season.StartDate.Year == startYear
                                && (managedClubIds.Contains(t.ClubId) || coachedTeamIds.Contains(t.Id)))
                    .Select(t => new { t.Id, t.Name })
                    .ToListAsync(cancellationToken);

                var isSingleCoachedTeam = teams.Count == 1;
                if (!isSingleCoachedTeam)
                    return CoachSquadComparisonResponse.NotCoachTeam;

                var team = teams[0];
                var dbPlayers = await db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == team.Id && tp.LeftDate == null)
                    .Select(tp => new
                    {
                        tp.Id,
                        tp.Player.Name,
                        tp.Player.LastName,
                        tp.Player.BirthDate,
                        tp.Player.UrlPhoto,
                        Dorsal = tp.Dorsal == null ? (int?)null : tp.Dorsal.Number
                    })
                    .ToListAsync(cancellationToken);

                var (resolved, _) = await teamService.GetStaticsTeamPlayers(
                    new GetAgeSummary.AgesQueryApp(request.TeamCode, request.SeasonId), cancellationToken);

                var rffmPlayers = resolved.Select(r => r.playerDetails is { } details
                    ? new SquadRffmPlayer(details.PlayerId, details.Name, details.BirthYear, details.PhotoUrl, details.JerseyNumber,
                        SeasonStats.From(details))
                    : new SquadRffmPlayer(r.teamPlayer.PlayerCode, r.teamPlayer.Name, null, null, r.teamPlayer.JerseyNumber));

                var squad = SquadPlayerMatcher.Compare(
                    dbPlayers.Select(p => new SquadDbPlayer(p.Id, $"{p.Name} {p.LastName}".Trim(), p.BirthDate?.Year, p.UrlPhoto, p.Dorsal)),
                    rffmPlayers);

                return new CoachSquadComparisonResponse(true, team.Id, team.Name, squad);
            }

            private int? SeasonStartYear(int seasonId)
            {
                var label = rffmOptions.Value.SelectableSeasons.FirstOrDefault(s => s.Id == seasonId)?.Label;
                var firstYear = label?.Split('-', '/')[0];
                return int.TryParse(firstYear, out var year) ? year : null;
            }
        }
    }
}
