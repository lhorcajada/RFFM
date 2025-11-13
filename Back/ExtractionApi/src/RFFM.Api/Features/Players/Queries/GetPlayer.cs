using HtmlAgilityPack;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Teams;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Players.Services;

namespace RFFM.Api.Features.Players.Queries
{
    public class GetPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/players/{id}",
                    async (int id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var request = new PlayerQuery(id);

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetPlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<ResponseDetailPlayer>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record PlayerQuery(int id) : Common.IQuery<ResponseDetailPlayer>
        {

        }

        public record ResponseDetailPlayer()
        {
            public List<PlayerStatisticsBySeason> StatisticsBySeason { get; init; } = new List<PlayerStatisticsBySeason>();
            public int PlayerId { get; set; }
            public string PlayerName { get; set; } = string.Empty;
            public int Ace { get; set; }


        }

        public class PlayerStatisticsBySeason
        {
            public PlayerStatisticsBySeason(string teamName)
            {
                TeamName = teamName;
                TeamParticipations = new List<TeamParticipation>();
            }

            public int SeasonId { get; set; }
            public string SeasonName { get; set; } = string.Empty;
            public string DorsalNumber { get; set; } = string.Empty;
            public string Position { get; set; } = string.Empty;
            public string CategoryName { get; set; } = string.Empty;

            // keep singular fields for compatibility
            public string CompetitionName { get; set; } = string.Empty;
            public string GroupName { get; set; } = string.Empty;
            public string TeamName { get; set; } = string.Empty;
            public int TeamPoints { get; set; }

            // per-season aggregated stats
            public int MatchesPlayed { get; set; }
            public int Goals { get; set; }
            public int HeadLine { get; set; }
            public int Substitute { get; set; }
            public int YellowCards { get; set; }
            public int RedCards { get; set; }
            public int DoubleYellowCards { get; set; }

            // New: a season may include participation in multiple competitions/teams
            public List<TeamParticipation> TeamParticipations { get; set; }

        }

        public record TeamParticipation(string CompetitionName, string GroupName, string TeamName, int TeamPoints, int SeasonId, string SeasonName);

        public class RequestHandler : IRequestHandler<PlayerQuery, ResponseDetailPlayer>
        {
            private readonly IPlayerService _playerService;

            public RequestHandler(IPlayerService playerService)
            {
                _playerService = playerService;
            }

            public async ValueTask<ResponseDetailPlayer> Handle(PlayerQuery request, CancellationToken cancellationToken)
            {
                return await _playerService.GetPlayerWithStatsAsync(request.id, cancellationToken);
            }

        }
    }
}
