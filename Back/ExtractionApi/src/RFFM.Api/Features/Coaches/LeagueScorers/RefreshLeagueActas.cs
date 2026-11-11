using System.Globalization;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.MatchForecast;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LeagueScorers
{
    /// <summary>
    /// POST /api/teams/{teamId}/league-scorers/actas?round=N — descarga de la RFFM y guarda las actas cerradas
    /// de la jornada que aún no están en BD (con el worker apagado solo se guardan las que alguien abre).
    /// </summary>
    public class RefreshLeagueActas : IFeatureModule
    {
        public const int MaxActasPerRequest = 30;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/teams/{teamId}/league-scorers/actas",
                    async (string teamId, int round, IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(await mediator.Send(new RefreshLeagueActasCommand(teamId, round), cancellationToken)))
                .WithName(nameof(RefreshLeagueActas))
                .WithTags("LeagueScorers")
                .Produces<RefreshResponse>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RefreshResponse(int Requested, int Stored, int Failed);

        public record RefreshLeagueActasCommand(string TeamId, int Round)
            : Common.ICommand<RefreshResponse>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<RefreshLeagueActasCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Round).GreaterThan(0);
            }
        }

        public class Handler(AppDbContext appDb, FederationDbContext db, IActaService actaService, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<RefreshLeagueActasCommand, RefreshResponse>
        {
            public async ValueTask<RefreshResponse> Handle(RefreshLeagueActasCommand request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);

                var missing = await (
                        from round in db.RffmRounds.AsNoTracking()
                        where round.GroupCode == league.GroupCode && round.Number == request.Round
                        from match in round.Matches
                        where match.RecordClosed == "1"
                              && !db.RffmMatchRecords.Any(r => r.RecordCode == match.RecordCode)
                        select match.RecordCode)
                    .Distinct()
                    .Take(MaxActasPerRequest)
                    .ToListAsync(cancellationToken);

                var competition = int.Parse(league.CompetitionCode, CultureInfo.InvariantCulture);
                var group = int.Parse(league.GroupCode, CultureInfo.InvariantCulture);

                int stored = 0, failed = 0;
                foreach (var code in missing)
                {
                    try
                    {
                        var acta = await actaService.GetMatchFromActaAsync(code, league.SeasonId, competition, group, cancellationToken);
                        if (acta?.RecordClosed?.Trim() == "1") stored++;
                        else failed++;
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        failed++;
                    }
                }

                return new RefreshResponse(missing.Count, stored, failed);
            }
        }
    }
}
