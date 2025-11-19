using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Players.Models;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Teams.Queries.Responses;
using RFFM.Api.Features.Teams.Services;
using Microsoft.Extensions.Caching.Memory;
using System;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId) =>
                    {
                        var request = new Query(teamId);

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetTeam))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<TeamRffm>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int TeamId) : Common.IQuery<Team>
        {

        }

        public class RequestHandler : IRequestHandler<Query, Team>
        {
            private readonly ITeamService _teamService;
            private readonly IMemoryCache _cache;

            public RequestHandler(ITeamService teamService, IMemoryCache cache)
            {
                _teamService = teamService;
                _cache = cache;
            }

            public async ValueTask<Team> Handle(Query request, CancellationToken cancellationToken)
            {
                var cacheKey = $"team_{request.TeamId}";

                return await _cache.GetOrCreateAsync(cacheKey, async entry =>
                {
                    // Cache validity: keep for 5 minutes by default. Adjust if needed.
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);

                    var team = await _teamService.GetTeamDetailsAsync(request.TeamId.ToString(), cancellationToken);
                    var statistics = await _teamService.GetStaticsTeamPlayers(new GetAgeSummary.AgesQuery(request.TeamId, 21), cancellationToken);
                    var playerDetails = statistics.resolved.Select(x => x.playerDetails);

                    var result = new Team
                    {
                        TeamCode = team.TeamCode,
                        TeamName = team.TeamName,
                        Assistants = team.Assistants.Select(a => new TeamAssistant
                        {
                            AssistantCode = a.AssistantCode,
                            Name = a.Name
                        }).ToList(),
                        Coaches = team.Coaches.Select(c => new TeamCoach
                        {
                            CoachCode = c.CoachCode,
                            Name = c.Name
                        }).ToList(),
                        Players = playerDetails.Select(p=> new Player
                        {
                            Team = team.TeamName,
                            TeamCode = team.TeamCode,
                            Name = p.Name,
                            Position = p.Position,
                            Age = p.Age,
                            JerseyNumber = p.JerseyNumber,
                            SeasonId = p.SeasonId,
                            PlayerId = p.PlayerId,
                            PhotoUrl = p.PhotoUrl,
                            BirthYear = p.BirthYear,
                            Cards = p.Cards,
                            Matches = p.Matches,
                            IsGoalkeeper = p.IsGoalkeeper,
                            TeamShieldUrl = p.TeamShieldUrl,
                            Competitions = p.Competitions,
                            TeamCategory = team.Category

                        }).ToList(),

                        Category = team.Category,
                        ClubCode = team.ClubCode,
                        ClubName = team.ClubName,
                        Delegates = team.Delegates.Select(d => new TeamDelegate
                        {
                            DelegateCode = d.DelegateCode,
                            Name = d.Name
                        }).ToList(),
                        AccessKey = team.AccessKey,
                        CategoryCode = team.CategoryCode,
                        ClubShield = team.ClubShield,
                        CorrespondenceAddress = team.CorrespondenceAddress,
                        CorrespondenceCity = team.CorrespondenceCity,
                        CorrespondenceEmail = team.CorrespondenceEmail,
                        CorrespondenceHolder = team.CorrespondenceHolder,
                        CorrespondencePostalCode = team.CorrespondencePostalCode,
                        CorrespondenceProvince = team.CorrespondenceProvince,
                        CorrespondenceTitle = team.CorrespondenceTitle,
                        Fax = team.Fax,
                        Field = team.Field,
                        FieldCode = team.FieldCode,
                        FieldPhoto = team.FieldPhoto,
                        Phones = team.Phones,
                        PlayDay = team.PlayDay,
                        PlaySchedule = team.PlaySchedule,
                        SessionOk = team.SessionOk,
                        Status = team.Status,
                        TrainingField = team.TrainingField,
                        Website = team.Website
                    };

                    return result;
                });
            }
        }
    }
}
