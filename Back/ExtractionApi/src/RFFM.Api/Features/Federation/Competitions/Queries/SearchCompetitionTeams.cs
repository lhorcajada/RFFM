using System.Globalization;
using System.Text;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Competitions.Queries
{
    /// <summary>
    /// Finds the group of a competition where a team (searched by name) plays.
    /// Groups are scanned one by one and the scan stops at the first group that
    /// contains a matching team.
    /// </summary>
    public class SearchCompetitionTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/competitions/{competitionId:int}/teams",
                    async (IMediator mediator, CancellationToken cancellationToken, int competitionId, string name, int? season = null) =>
                    {
                        var response = await mediator.Send(new QueryApp(competitionId, name, season), cancellationToken);
                        return Results.Ok(response);
                    })
                .WithName(nameof(SearchCompetitionTeams))
                .WithTags(CompetitionsConstants.CompetitionsFeature)
                .Produces<ResponseTeamMatch[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryApp(int CompetitionId, string Name, int? Season) : Common.IQueryApp<ResponseTeamMatch[]>;

        public record ResponseTeamMatch(
            string TeamCode,
            string TeamName,
            string GroupCode,
            string GroupName,
            string CompetitionCode,
            string CompetitionName);

        public class RequestHandler : IRequestHandler<QueryApp, ResponseTeamMatch[]>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ResponseTeamMatch[]> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                var searched = Normalize(request.Name);
                if (string.IsNullOrEmpty(searched))
                    return [];

                var groups = await _competitionService
                    .GetGroupsAsync(request.CompetitionId.ToString(), cancellationToken)
                    .ConfigureAwait(false);
                if (groups is null || groups.Length == 0)
                    return [];

                foreach (var group in groups)
                {
                    var matches = await FindTeamsInGroupAsync(group.Id, searched, cancellationToken).ConfigureAwait(false);
                    if (matches.Count == 0)
                        continue;

                    var competitionName = await GetCompetitionNameAsync(request, cancellationToken).ConfigureAwait(false);
                    return matches
                        .Select(t => new ResponseTeamMatch(
                            t.TeamId,
                            t.TeamName,
                            group.Id.ToString(),
                            group.Name,
                            request.CompetitionId.ToString(),
                            competitionName))
                        .ToArray();
                }

                return [];
            }

            private async Task<List<Models.TeamResponse>> FindTeamsInGroupAsync(
                int groupId, string searched, CancellationToken cancellationToken)
            {
                try
                {
                    var classification = await _competitionService
                        .GetClassification(groupId, cancellationToken)
                        .ConfigureAwait(false);

                    return (classification?.Teams ?? [])
                        .Where(t => Normalize(t.TeamName).Contains(searched, StringComparison.Ordinal))
                        .ToList();
                }
                catch (Exception) when (!cancellationToken.IsCancellationRequested)
                {
                    return [];
                }
            }

            private async Task<string> GetCompetitionNameAsync(QueryApp request, CancellationToken cancellationToken)
            {
                var competitions = await _competitionService
                    .GetCompetitionsAsync(request.Season, cancellationToken)
                    .ConfigureAwait(false);
                return competitions?.FirstOrDefault(c => c.CompetitionId == request.CompetitionId)?.Name ?? string.Empty;
            }

            private static string Normalize(string? value)
            {
                if (string.IsNullOrWhiteSpace(value))
                    return string.Empty;

                var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
                var builder = new StringBuilder(decomposed.Length);
                foreach (var c in decomposed)
                {
                    if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                        builder.Append(c);
                }

                return builder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
            }
        }
    }
}
