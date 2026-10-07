using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries.Responses;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using System.Globalization;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetGoalSectors : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamCode}/goal-sectors", async (IMediator mediator, CancellationToken cancellationToken,
                    int competitionId, int groupId, int teamCode1, int teamCode2, int? competitionId2, int? groupId2,
                    int? season) =>
                {
                    var request = new QueryApp(
                        new TeamSelection(teamCode1, competitionId, groupId),
                        new TeamSelection(teamCode2, competitionId2 ?? competitionId, groupId2 ?? groupId),
                        season);
                    var response = await mediator.Send(request, cancellationToken);
                    return Results.Ok(response);
                })
                .WithName(nameof(GetGoalSectors))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<List<GoalSectorsResponse>>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record TeamSelection(int TeamCode, int CompetitionId, int GroupId);

        public record QueryApp(TeamSelection Team1, TeamSelection Team2, int? Season = null)
            : Common.IQueryApp<List<GoalSectorsResponse>>;

        public class RequestHandler : IRequestHandler<QueryApp, List<GoalSectorsResponse>>
        {
            private const int SectorsPerHalf = 3;

            private sealed record CompetitionInSeason(int SeasonId, int MatchTime);

            private readonly ICalendarService _calendarService;
            private readonly ICompetitionService _competitionService;
            private readonly IActaService _actaService;
            private readonly ISectorFactory _sectorFactory;
            private readonly IOptions<RffmOptions> _rffmOptions;

            public RequestHandler(ICalendarService calendarService,
                ICompetitionService competitionService,
                IActaService actaService, ISectorFactory sectorFactory,
                IOptions<RffmOptions> rffmOptions)
            {
                _calendarService = calendarService;
                _competitionService = competitionService;
                _actaService = actaService;
                _sectorFactory = sectorFactory;
                _rffmOptions = rffmOptions;
            }

            public async ValueTask<List<GoalSectorsResponse>> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                var seasonsToSearch = new[] { request.Season ?? _rffmOptions.Value.CurrentSeasonId }
                    .Concat(_rffmOptions.Value.SelectableSeasons.Select(s => s.Id))
                    .Distinct()
                    .ToList();
                var competitionsBySeason = new Dictionary<int, ResponseCompetition[]>();

                var team1 = await BuildTeamAsync(request.Team1, seasonsToSearch, competitionsBySeason, cancellationToken);
                var team2 = await BuildTeamAsync(request.Team2, seasonsToSearch, competitionsBySeason, cancellationToken);
                return new List<GoalSectorsResponse> { team1, team2 };
            }

            private async Task<CompetitionInSeason> FindCompetitionAsync(int competitionId, IReadOnlyList<int> seasons,
                Dictionary<int, ResponseCompetition[]> competitionsBySeason, CancellationToken cancellationToken)
            {
                foreach (var seasonId in seasons)
                {
                    if (!competitionsBySeason.TryGetValue(seasonId, out var competitions))
                    {
                        competitions = await _competitionService.GetCompetitionsAsync(seasonId, cancellationToken);
                        competitionsBySeason[seasonId] = competitions;
                    }

                    var competition = competitions.FirstOrDefault(c => c.CompetitionId == competitionId);
                    var hasMatchTime = competition is { MatchTime: > 0 };
                    if (hasMatchTime)
                        return new CompetitionInSeason(seasonId, competition!.MatchTime);
                }

                throw new NotFoundException(
                    $"No se ha encontrado la competición {competitionId} en las temporadas RFFM disponibles.",
                    ErrorCodes.CompetitionNotFound);
            }

            private async Task<GoalSectorsResponse> BuildTeamAsync(TeamSelection selection, IReadOnlyList<int> seasons,
                Dictionary<int, ResponseCompetition[]> competitionsBySeason, CancellationToken cancellationToken)
            {
                var teamCode = selection.TeamCode.ToString(CultureInfo.InvariantCulture);
                var competition = await FindCompetitionAsync(selection.CompetitionId, seasons, competitionsBySeason, cancellationToken);
                var matchTime = competition.MatchTime;

                var calendar = await _calendarService.GetCalendarAsync(selection.CompetitionId, selection.GroupId, cancellationToken);
                var codesActas = calendar.MatchDays.Where(m => m.Date <= DateTime.Now.Date)
                    .SelectMany(md => md.Matches.Where(m => m.LocalTeamCode == teamCode || m.VisitorTeamCode == teamCode))
                    .Select(m => m.MatchRecordCode)
                    .ToList();

                var sectors = _sectorFactory.BuildSectors(matchTime, SectorsPerHalf);
                var response = new GoalSectorsResponse();
                foreach (var codeActa in codesActas)
                {
                    var acta = await _actaService.GetMatchFromActaAsync(codeActa, competition.SeasonId,
                        selection.CompetitionId, selection.GroupId, cancellationToken);
                    if (acta == null) throw new Exception($"El acta {codeActa} no se ha encontrado");
                    AgroupGoalsBySector(acta, teamCode, sectors, response);
                }

                response.TeamCode = teamCode;
                response.MatchTime = matchTime;
                response.Sectors = sectors;
                return response;
            }

            private static void AgroupGoalsBySector(MatchRffm acta, string teamCode, List<Sector> sectorsTeam,
                GoalSectorsResponse teamGoalResponse)
            {
                if (acta.LocalTeamCode == teamCode)
                {
                    foreach (var localGoal in acta.LocalGoalsList)
                    {
                        var sector = sectorsTeam.FirstOrDefault(s =>
                            Convert.ToInt16(localGoal.Minute) >= s.StartMinute &&
                            Convert.ToInt16(localGoal.Minute) <= s.EndMinute);
                        if (localGoal.GoalType == "102")
                        {
                            if (sector != null)
                                sector.GoalsAgainst++;
                            teamGoalResponse.TotalGoalsAgainst++;
                        }
                        else
                        {
                            if (sector != null)
                                sector.GoalsFor++;
                            teamGoalResponse.TotalGoalsFor++;
                        }
                        teamGoalResponse.TeamName = acta.LocalTeam;
                    }

                    foreach (var awayGoal in acta.AwayGoalsList)
                    {
                        var sector = sectorsTeam.FirstOrDefault(s =>
                            Convert.ToInt16(awayGoal.Minute) >= s.StartMinute &&
                            Convert.ToInt16(awayGoal.Minute) <= s.EndMinute);
                        if (awayGoal.GoalType == "102")
                        {
                            if (sector != null)
                                sector.GoalsFor++;
                            teamGoalResponse.TotalGoalsFor++;
                        }
                        else
                        {
                            if (sector != null)
                                sector.GoalsAgainst++;
                            teamGoalResponse.TotalGoalsAgainst++;
                        }
                    }
                    teamGoalResponse.MatchesProcessed++;
                }

                if (acta.AwayTeamCode != teamCode) return;
                {
                    foreach (var awayGoal in acta.AwayGoalsList)
                    {
                        var sector = sectorsTeam.FirstOrDefault(s =>
                            Convert.ToInt16(awayGoal.Minute) >= s.StartMinute &&
                            Convert.ToInt16(awayGoal.Minute) <= s.EndMinute);
                        if (awayGoal.GoalType == "102")
                        {
                            if (sector != null)
                                sector.GoalsAgainst++;
                            teamGoalResponse.TotalGoalsAgainst++;
                        }
                        else
                        {
                            if (sector != null)
                                sector.GoalsFor++;
                            teamGoalResponse.TotalGoalsFor++;
                        }
                    }

                    foreach (var localGoal in acta.LocalGoalsList)
                    {
                        var sector = sectorsTeam.FirstOrDefault(s =>
                            Convert.ToInt16(localGoal.Minute) >= s.StartMinute &&
                            Convert.ToInt16(localGoal.Minute) <= s.EndMinute);
                        if (localGoal.GoalType == "102")
                        {
                            if (sector != null)
                                sector.GoalsFor++;
                            teamGoalResponse.TotalGoalsFor++;
                        }
                        else
                        {
                            if (sector != null)
                                sector.GoalsAgainst++;
                            teamGoalResponse.TotalGoalsAgainst++;
                        }

                    }
                    teamGoalResponse.MatchesProcessed++;


                }

            }
        }

    }



    public class GoalData
    {
        public string TeamCode { get; set; } = string.Empty;
        public string TeamName { get; set; } = string.Empty;
        public string PlayerCode { get; set; } = string.Empty;

        public string PlayerName { get; set; } = string.Empty;

        public string Minute { get; set; } = string.Empty;

        public string GoalType { get; set; } = string.Empty;

        public bool IsGoalFor { get; set; }
    }

}
