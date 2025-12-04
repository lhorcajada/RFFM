using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Teams.Services;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetAgeSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}/age-summary",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId, int season = 21) =>
                    {
                        var request = new AgesQueryApp(teamId, season);
                        var response = await mediator.Send(request, cancellationToken);
                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName("GetTeamAgeSummary")
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<AgeCount[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        // QueryApp to get age distribution (allow season to be provided)
        public record AgesQueryApp(int TeamId, int SeasonId = 21) : Common.IQueryApp<AgeCount[]>;

        public class AgeCount
        {
            public int Age { get; set; }
            public int Total { get; set; }
        }

        // Handler for ages query - now delegates to ITeamService
        public class AgesRequestHandler(ITeamService teamService) : IRequestHandler<AgesQueryApp, AgeCount[]>
        {
            public async ValueTask<AgeCount[]> Handle(AgesQueryApp request, CancellationToken cancellationToken)
            {
                var (resolved, handle) = await teamService.GetStaticsTeamPlayers(request, cancellationToken);

                if (handle != null && handle.Length > 0)
                    return handle;

                // fallback: compute from resolved tuples
                if (resolved == null || resolved.Length == 0)
                    return [];

                var ages = new List<int>();

                foreach (var (teamPlayerRffm, player) in resolved)
                {
                    int? age = null;

                    if (player != null)
                    {       
                        if (player.Age > 0) age = player.Age;
                        else if (player.BirthYear > 0) age = DateTime.Now.Year - player.BirthYear;
                    }

                    if (!age.HasValue)
                    {
                        if (teamPlayerRffm.GetType().GetProperty("Age") != null)
                        {
                            var val = teamPlayerRffm.GetType().GetProperty("Age")!.GetValue(teamPlayerRffm);
                            if (val is int vi && vi > 0) age = vi;
                        }

                        if (!age.HasValue && teamPlayerRffm.GetType().GetProperty("Ace") != null)
                        {
                            var val = teamPlayerRffm.GetType().GetProperty("Ace")!.GetValue(teamPlayerRffm);
                            if (val is int vi && vi > 0) age = vi;
                        }

                        if (!age.HasValue && teamPlayerRffm.GetType().GetProperty("Edad") != null)
                        {
                            var val = teamPlayerRffm.GetType().GetProperty("Edad")!.GetValue(teamPlayerRffm);
                            if (val is int vi && vi > 0) age = vi;
                        }

                        if (!age.HasValue && !string.IsNullOrWhiteSpace(teamPlayerRffm.Name))
                        {
                            var m = System.Text.RegularExpressions.Regex.Match(teamPlayerRffm.Name, "(\\d{1,2})");
                            if (m.Success && int.TryParse(m.Value, out var parsed)) age = parsed;
                        }
                    }

                    if (age.HasValue)
                        ages.Add(age.Value);
                }

                if (ages.Count == 0)
                    return [];

                var grouped = ages.GroupBy(a => a)
                    .Select(g => new AgeCount { Age = g.Key, Total = g.Count() })
                    .OrderBy(a => a.Age)
                    .ToArray();

                return grouped;
            }
        }
    }
}
