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
using System.Globalization;

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
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<Classification[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int Season, int Competition, int Group, int PlayType) : Common.IQuery<Classification[]>
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
            [JsonPropertyName("color")]
            public string Color { get; set; } = string.Empty;

            [JsonPropertyName("posicion")]
            public string Position { get; set; } = string.Empty;

            [JsonPropertyName("url_img")]
            public string ImageUrl { get; set; } = string.Empty;

            [JsonPropertyName("codequipo")]
            public string TeamId { get; set; } = string.Empty;

            [JsonPropertyName("nombre")]
            public string TeamName { get; set; } = string.Empty;

            [JsonPropertyName("jugados")]
            public string Played { get; set; } = string.Empty;

            [JsonPropertyName("ganados")]
            public string Won { get; set; } = string.Empty;

            [JsonPropertyName("perdidos")]
            public string Lost { get; set; } = string.Empty;

            [JsonPropertyName("empatados")]
            public string Drawn { get; set; } = string.Empty;

            [JsonPropertyName("penaltis")]
            public string Penalties { get; set; } = string.Empty;

            [JsonPropertyName("goles_a_favor")]
            public string GoalsFor { get; set; } = string.Empty;

            [JsonPropertyName("goles_en_contra")]
            public string GoalsAgainst { get; set; } = string.Empty;

            [JsonPropertyName("jugados_casa")]
            public string HomePlayed { get; set; } = string.Empty;

            [JsonPropertyName("ganados_casa")]
            public string HomeWon { get; set; } = string.Empty;

            [JsonPropertyName("empatados_casa")]
            public string HomeDrawn { get; set; } = string.Empty;

            [JsonPropertyName("ganados_penalti_casa")]
            public string HomePenaltyWins { get; set; } = string.Empty;

            [JsonPropertyName("perdidos_casa")]
            public string HomeLost { get; set; } = string.Empty;

            [JsonPropertyName("jugados_fuera")]
            public string AwayPlayed { get; set; } = string.Empty;

            [JsonPropertyName("ganados_fuera")]
            public string AwayWon { get; set; } = string.Empty;

            [JsonPropertyName("empatados_fuera")]
            public string AwayDrawn { get; set; } = string.Empty;

            [JsonPropertyName("ganados_penalti_fuera")]
            public string AwayPenaltyWins { get; set; } = string.Empty;

            [JsonPropertyName("perdidos_fuera")]
            public string AwayLost { get; set; } = string.Empty;

            [JsonPropertyName("puntos")]
            public string Points { get; set; } = string.Empty;

            [JsonPropertyName("puntos_sancion")]
            public string SanctionPoints { get; set; } = string.Empty;

            [JsonPropertyName("puntos_local")]
            public string HomePoints { get; set; } = string.Empty;

            [JsonPropertyName("puntos_visitante")]
            public string AwayPoints { get; set; } = string.Empty;

            [JsonPropertyName("mostrar_coeficiente")]
            public string ShowCoefficient { get; set; } = string.Empty;

            [JsonPropertyName("coeficiente")]
            public string Coefficient { get; set; } = string.Empty;

            [JsonPropertyName("racha_partidos")]
            public List<MatchStreak> MatchStreaks { get; set; } = new();
        }

        public class MatchStreak
        {
            //G = Ganado, P = Perdido, E = Empatado
            [JsonPropertyName("tipo")]
            public string Type { get; set; } = string.Empty;

            [JsonPropertyName("color")]
            public string Color { get; set; } = string.Empty;
        }

        public class GroupRounds
        {
            [JsonPropertyName("jornadas")]
            public List<Round> Rounds { get; set; }
        }

        public class Round
        {
            [JsonPropertyName("codjornada")]
            // Some endpoints return codjornada as number, others as string. Keep as string and parse when needed.
            public string JourneyId { get; set; } = string.Empty;
            [JsonPropertyName("nombre")]
            public string Name { get; set; } = string.Empty;
            [JsonPropertyName("fecha_jornada")]
            public string Date { get; set; } = string.Empty;

        }

        public class RequestHandler : IRequestHandler<Query, Classification[]>
        {
            public async ValueTask<Classification[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var jornada = await CalculateActiveRound(request.Group, cancellationToken);
                var url =
                    $"https://www.rffm.es/api/standings?idGroup={request.Group}&round={jornada}";

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
                        return Array.Empty<Classification>();

                    var result = dtos
                        .Classification
                        .Select(d => new Classification
                        {
                                                        TeamId = d.TeamId.Trim(),
                                                        TeamName = d.TeamName.Trim(),
                                                        Color = d.Color.Trim(),
                                                        Position = d.Position.Trim(),
                                                        AwayLost = d.AwayLost.Trim(),
                                                        AwayPlayed = d.AwayPlayed.Trim(),
                                                        AwayPoints = d.AwayPoints.Trim(),
                                                        AwayWon = d.AwayWon.Trim(),
                                                        AwayDrawn = d.AwayDrawn.Trim(),
                                                        AwayPenaltyWins = d.AwayPenaltyWins.Trim(),
                                                        Coefficient = d.Coefficient.Trim(),
                                                        Drawn = d.Drawn.Trim(),
                                                        GoalsAgainst = d.GoalsAgainst.Trim(),
                                                        GoalsFor = d.GoalsFor.Trim(),
                                                        HomeDrawn = d.HomeDrawn.Trim(),
                                                        HomeLost = d.HomeLost.Trim(),
                                                        HomePlayed = d.HomePlayed.Trim(),
                                                        HomePenaltyWins = d.HomePenaltyWins.Trim(),
                                                        HomeWon = d.HomeWon.Trim(),
                                                        ImageUrl = d.ImageUrl.Trim(),
                                                        Lost = d.Lost.Trim(),
                                                        Penalties = d.Penalties.Trim(),
                                                        Played = d.Played.Trim(),
                                                        Points = d.Points.Trim(),
                                                        SanctionPoints = d.SanctionPoints.Trim(),
                                                        ShowCoefficient = d.ShowCoefficient.Trim(),
                                                        Won = d.Won.Trim(),
                                                        MatchStreaks = d.MatchStreaks.Select(ms => new MatchStreak
                                                        {
                                                            Type = ms.Type.Trim(),
                                                        }).ToList()

                        })
                        .ToArray();

                    return result;
                }
                catch
                {
                    return [];
                }

            }

            private async Task<int> CalculateActiveRound(int groupId, CancellationToken cancellationToken)
            {
                var url =
                    $"https://www.rffm.es/api/group-rounds?idGroup={groupId}&fetchBy=standings";

                using var http = new HttpClient();
                // add a simple User-Agent to avoid some servers rejecting the request
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

                var htmlFetcher = new HtmlFetcher(http);
                var content = await htmlFetcher.FetchAsync(url, cancellationToken);

                if (string.IsNullOrWhiteSpace(content))
                    return 0;

                try
                {
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                    var dtos = JsonSerializer.Deserialize<GroupRounds>(content, options);
                    if (dtos == null || !dtos.Rounds.Any())
                        return 0;

                    // Try to parse the dates of the rounds using common formats and Spanish culture
                    var formats = new[] { "dd/MM/yyyy", "dd/MM/yyyy HH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd", "dd-MM-yyyy", "dd-MM-yyyy HH:mm" };
                    var culture = CultureInfo.GetCultureInfo("es-ES");
                    var parsedRounds = new List<(Round round, DateTime date)>();

                    foreach (var r in dtos.Rounds)
                    {
                        if (string.IsNullOrWhiteSpace(r.Date))
                            continue;

                        if (DateTime.TryParseExact(r.Date.Trim(), formats, culture, DateTimeStyles.AssumeLocal, out var dt) ||
                            DateTime.TryParse(r.Date.Trim(), culture, DateTimeStyles.AssumeLocal, out dt) ||
                            DateTime.TryParse(r.Date.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out dt))
                        {
                            parsedRounds.Add((r, dt.Date));
                        }
                    }

                    if (!parsedRounds.Any())
                        return 0;

                    var today = DateTime.Now.Date;

                    // Find the latest round whose date is <= today
                    var pastOrToday = parsedRounds.Where(t => t.date <= today).ToList();
                    if (pastOrToday.Any())
                    {
                        var latest = pastOrToday.OrderByDescending(t => t.date).First();
                        // Try to parse journey id to int; return 0 on failure
                        if (int.TryParse(latest.round.JourneyId, out var parsedId))
                            return parsedId;
                        return 0;
                    }

                    // If there is no past round, return the next upcoming round (earliest future)
                    var next = parsedRounds.OrderBy(t => t.date).First();
                    if (int.TryParse(next.round.JourneyId, out var nextId))
                        return nextId;
                    return 0;
                }
                catch
                {
                    return 0;

                }
            }
        }

    }
}
