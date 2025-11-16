using HtmlAgilityPack;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams",
                    async (IMediator mediator, CancellationToken cancellationToken, int season = 21, int competition = 25255269, int group = 25255283, int playType = 1) =>
                    {
                        var request = new Query(season, competition, group, playType);

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetTeams))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<ResponseTeam[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int Season, int Competition, int Group, int PlayType) : Common.IQuery<ResponseTeam[]>
        {

        }

        public record ResponseTeam(string Id, string Name, string Link);
        public class Standing
        {
            [JsonPropertyName("clasificacion")]
            public Classification[] Classification { get; set; }
        }

        public class Classification
        {
            [JsonPropertyName("codequipo")]
            public string TeamId { get; set; }

            [JsonPropertyName("nombre")]
            public string TeamName { get; set; }

        }


        public class RequestHandler : IRequestHandler<Query, ResponseTeam[]>
        {
            public async ValueTask<ResponseTeam[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var url =
                    $"https://www.rffm.es/api/standings?idGroup={request.Group}&round=1";

                using var http = new HttpClient();
                // add a simple User-Agent to avoid some servers rejecting the request
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

                var htmlFetcher = new HtmlFetcher(http);
                var content = await htmlFetcher.FetchAsync(url, cancellationToken);

                if (string.IsNullOrWhiteSpace(content))
                    return [];

                try
                {
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                    var dtos = JsonSerializer.Deserialize<Standing>(content, options);
                    if (dtos == null || !dtos.Classification.Any())
                        return Array.Empty<ResponseTeam>();

                    var result = dtos
                        .Classification
                        .Select(d => new ResponseTeam(d.TeamId.Trim(), d.TeamName.Trim(), $"https://rffm.es/fichaequipo/{d.TeamId.Trim()}"))
                        .ToArray();

                    return result;
                }
                catch
                {
                    return [];
                }

            }

        }

    }
}
