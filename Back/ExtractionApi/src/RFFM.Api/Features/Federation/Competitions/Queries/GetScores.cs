using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Competitions.Queries
{
    public class GetScores : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/scores", async (IMediator mediator, CancellationToken cancellationToken, int competitionId = 25255269, int gropuId= 25255283) =>
                {
                    var request = new QueryAppScores(competitionId.ToString(), gropuId.ToString());
                    var response = await mediator.Send(request, cancellationToken);
                    return response != null ? Results.Ok(response) : Results.NotFound();
                })
                .WithName(nameof(GetScores))
                .WithTags(CompetitionsConstants.CompetitionsFeature)
                .Produces<ResponseScores[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryAppScores(string CompetitionId, string GroupId) : Common.IQueryApp<ResponseScores[]>;

        public record ResponseScores
        {
            public string PlayerId { get; set; } = string.Empty;
            public string PlayerName { get; set; } = string.Empty;
            public string TeamId { get; set; } = string.Empty;
            public string TeamName { get; set; } = string.Empty;
            public int MatchesPlayed { get; set; }
            public int Scores { get; set; }
            public int PenaltyScores { get; set; }
            public decimal AverageScores { get; set; }
        }

        public class RequestHandler : IRequestHandler<QueryAppScores, ResponseScores[]>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ResponseScores[]> Handle(QueryAppScores request, CancellationToken cancellationToken)
            {
                if (string.IsNullOrWhiteSpace(request.CompetitionId))
                    return Array.Empty<ResponseScores>();

                var scores = await _competitionService.GetScoresAsync(request.CompetitionId, request.GroupId, cancellationToken).ConfigureAwait(false);
                if (scores == null || scores.Length == 0)
                    return Array.Empty<ResponseScores>();

                return scores.ToArray();
            }
        }
    }

}
