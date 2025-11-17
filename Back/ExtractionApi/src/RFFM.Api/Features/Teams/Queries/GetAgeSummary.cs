using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Players.Models;
using RFFM.Api.Features.Players.Services;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Teams.Services;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetAgeSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}/age-summary",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId, int seasonId) =>
                    {
                        var request = new AgesQuery(teamId, seasonId);
                        var response = await mediator.Send(request, cancellationToken);
                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName("GetTeamAgeSummary")
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<AgeCount[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        // Query to get age distribution
        public record AgesQuery(int TeamId, int SeasonId) : Common.IQuery<AgeCount[]>;

        public class AgeCount
        {
            public int Age { get; set; }
            public int Total { get; set; }
        }

        // Handler for ages query
        public class AgesRequestHandler : IRequestHandler<AgesQuery, AgeCount[]>
        {
            private readonly ITeamService _teamService;
            private readonly IPlayerService _playerService;

            public AgesRequestHandler(ITeamService teamService, IPlayerService playerService)
            {
                _teamService = teamService;
                _playerService = playerService;
            }

            public async ValueTask<AgeCount[]> Handle(AgesQuery request, CancellationToken cancellationToken)
            {
                var (resolved, handle) = await _teamService.GetStaticsTeamPlayers(request, cancellationToken);

                var ages = new List<int>();

                foreach (var item in resolved)
                {
                    var pd = item.playerDetails;
                    int? age = null;

                    if (pd != null)
                    {
                        if (pd.Age > 0) age = pd.Age;
                        else if (pd.BirthYear > 0)
                        {
                            var now = DateTime.Now.Year;
                            age = now - pd.BirthYear;
                        }
                    }

                    if (age.HasValue)
                        ages.Add(age.Value);
                }

                if (!ages.Any())
                    return Array.Empty<AgeCount>();

                var grouped = ages.GroupBy(a => a)
                    .Select(g => new AgeCount { Age = g.Key, Total = g.Count() })
                    .OrderBy(a => a.Age)
                    .ToArray();

                return grouped;
            }


        }
    }
}
