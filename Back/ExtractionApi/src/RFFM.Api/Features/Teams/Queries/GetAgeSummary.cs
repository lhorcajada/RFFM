using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Teams.Services;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetAgeSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}/age-summary",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId, int season = 21) =>
                    {
                        var request = new AgesQuery(teamId, season);
                        var response = await mediator.Send(request, cancellationToken);
                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName("GetTeamAgeSummary")
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<AgeCount[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        // Query to get age distribution (allow season to be provided)
        public record AgesQuery(int TeamId, int SeasonId = 21) : Common.IQuery<AgeCount[]>;

        public class AgeCount
        {
            public int Age { get; set; }
            public int Total { get; set; }
        }

        // Handler for ages query - now delegates to ITeamService
        public class AgesRequestHandler : IRequestHandler<AgesQuery, AgeCount[]>
        {
            private readonly ITeamService _teamService;

            public AgesRequestHandler(ITeamService teamService)
            {
                _teamService = teamService;
            }

            public async ValueTask<AgeCount[]> Handle(AgesQuery request, CancellationToken cancellationToken)
            {
                var (resolved, handle) = await _teamService.GetStaticsTeamPlayers(request, cancellationToken);

                if (handle != null && handle.Length > 0)
                    return handle;

                // fallback: compute from resolved tuples
                if (resolved == null || resolved.Length == 0)
                    return Array.Empty<AgeCount>();

                var ages = new List<int>();

                foreach (var item in resolved)
                {
                    var p = item.teamPlayer;
                    var pd = item.playerDetails;
                    int? age = null;

                    if (pd != null)
                    {
                        if (pd.Age > 0) age = pd.Age;
                        else if (pd.BirthYear > 0) age = DateTime.Now.Year - pd.BirthYear;
                    }

                    if (!age.HasValue)
                    {
                        if (p is not null)
                        {
                            if (p.GetType().GetProperty("Age") != null)
                            {
                                var val = p.GetType().GetProperty("Age")!.GetValue(p);
                                if (val is int vi && vi > 0) age = vi;
                            }

                            if (!age.HasValue && p.GetType().GetProperty("Ace") != null)
                            {
                                var val = p.GetType().GetProperty("Ace")!.GetValue(p);
                                if (val is int vi && vi > 0) age = vi;
                            }

                            if (!age.HasValue && p.GetType().GetProperty("Edad") != null)
                            {
                                var val = p.GetType().GetProperty("Edad")!.GetValue(p);
                                if (val is int vi && vi > 0) age = vi;
                            }

                            if (!age.HasValue && !string.IsNullOrWhiteSpace(p.Name))
                            {
                                var m = System.Text.RegularExpressions.Regex.Match(p.Name, "(\\d{1,2})");
                                if (m.Success && int.TryParse(m.Value, out var parsed)) age = parsed;
                            }
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
