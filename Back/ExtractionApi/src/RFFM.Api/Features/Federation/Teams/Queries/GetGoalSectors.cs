using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries.Responses;
using RFFM.Api.Features.Federation.Teams.Services;
using System.Globalization;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetGoalSectors : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamCode}/goal-sectors", async (IMediator mediator, CancellationToken cancellationToken,
                    int competitionId = 25255269, int groupId = 25255283, int teamCode1 = 13553720, int teamCode2 = 2280600) =>
                {
                    var teamCodesToCompare = new List<int> { teamCode1, teamCode2 };
                    var request = new QueryApp(competitionId, groupId, teamCodesToCompare);
                    var response = await mediator.Send(request, cancellationToken);
                    return Results.Ok(response);
                })
                .WithName(nameof(GetGoalSectors))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<List<GoalSectorsResponse>>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryApp(int CompetitionId, int GroupId, List<int> TeamCodesToCompare)
            : Common.IQueryApp<List<GoalSectorsResponse>>;



        public class RequestHandler : IRequestHandler<QueryApp, List<GoalSectorsResponse>>
        {
            private readonly ICalendarService _calendarService;
            private readonly ICompetitionService _competitionService;
            private readonly IActaService _actaService;
            private readonly ISectorFactory _sectorFactory;

            public RequestHandler(ICalendarService calendarService,
                ICompetitionService competitionService,
                IActaService actaService, ISectorFactory sectorFactory)
            {
                _calendarService = calendarService;
                _competitionService = competitionService;
                _actaService = actaService;
                _sectorFactory = sectorFactory;
            }

            public async ValueTask<List<GoalSectorsResponse>> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                if (request.TeamCodesToCompare == null || request.TeamCodesToCompare.Count < 2)
                    throw new Exception("No hay equipos que comparar");

                var teamCode1 = request.TeamCodesToCompare[0].ToString(CultureInfo.InvariantCulture);
                var teamCode2 = request.TeamCodesToCompare[1].ToString(CultureInfo.InvariantCulture);

                // Obtain match duration (MatchTime property)
                var competitions = await _competitionService.GetCompetitionsAsync(cancellationToken);
                var matchTime = competitions
                    .FirstOrDefault(c => c.CompetitionId == request.CompetitionId)?.MatchTime ?? 90;

                // Configure sectors: 3 sectors per half (configurable here)
                const int sectorsPerHalf = 3;

                var calendar = await _calendarService.GetCalendarAsync(request.CompetitionId, request.GroupId, cancellationToken);
                var team1Matches = calendar.MatchDays.Where(m => m.Date <= DateTime.Now.Date)
                    .SelectMany(cmd => cmd.Matches.Where(m => m.LocalTeamCode == teamCode1 || m.VisitorTeamCode == teamCode1)).ToList();
                var team2Matches = calendar.MatchDays.Where(m => m.Date <= DateTime.Now.Date)
                    .SelectMany(cmd => cmd.Matches.Where(m => m.LocalTeamCode == teamCode2 || m.VisitorTeamCode == teamCode2)).ToList();
                var codesActasTeam1 = team1Matches.Select(m => m.MatchRecordCode).ToList();
                var codesActasTeam2 = team2Matches.Select(m => m.MatchRecordCode).ToList();
                var sectorsTeam1 = _sectorFactory.BuildSectors(matchTime, sectorsPerHalf);
                var sectorsTeam2 = _sectorFactory.BuildSectors(matchTime, sectorsPerHalf);
                var team1GoalResponse = new GoalSectorsResponse();
                var team2GoalResponse = new GoalSectorsResponse();
                foreach (var codeActa in codesActasTeam1)
                {
                    var acta = await _actaService.GetMatchFromActaAsync(codeActa, 21, request.CompetitionId,
                        request.GroupId, cancellationToken);
                    if (acta == null) throw new Exception($"El acta {codeActa} no se ha encontrado");
                    AgroupGoalsBySector(acta, teamCode1, sectorsTeam1, team1GoalResponse);
                }
                foreach (var codeActa in codesActasTeam2)
                {
                    var acta = await _actaService.GetMatchFromActaAsync(codeActa, 21, request.CompetitionId,
                        request.GroupId, cancellationToken);
                    if (acta == null) throw new Exception($"El acta {codeActa} no se ha encontrado");
                    AgroupGoalsBySector(acta, teamCode2, sectorsTeam2, team2GoalResponse);
                }
                team1GoalResponse.TeamCode = teamCode1;
                team2GoalResponse.TeamCode = teamCode2;
                team1GoalResponse.Sectors = sectorsTeam1;
                team2GoalResponse.Sectors = sectorsTeam2;
                return new List<GoalSectorsResponse> { team1GoalResponse, team2GoalResponse };
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
