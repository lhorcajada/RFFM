using System.Security.Claims;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.SquadHistory
{
    /// <summary>
    /// POST /teams/{teamCode}/squad-history/requests — pide el historial de la plantilla.
    /// 200 si ya está completado (y no se pide actualizar); 202 si se ha encolado o está en curso.
    /// </summary>
    public class RequestSquadHistory : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/teams/{teamCode}/squad-history/requests",
                    async (string teamCode, RequestSquadHistoryBody body, IMediator mediator, HttpContext httpContext,
                        CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var command = new RequestSquadHistoryCommand(teamCode, body.SeasonId, body.TeamName, body.Refresh, userId);
                        var result = await mediator.Send(command, cancellationToken);

                        var isReady = result.Status == SquadHistoryStatus.Completed.Name;
                        return isReady ? Results.Ok(result) : Results.Accepted(value: result);
                    })
                .WithName(nameof(RequestSquadHistory))
                .WithTags(SquadHistoryConstants.SquadHistoryFeature)
                .Produces<SquadHistoryRequestResponse>(StatusCodes.Status200OK)
                .Produces<SquadHistoryRequestResponse>(StatusCodes.Status202Accepted)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record RequestSquadHistoryBody(int SeasonId, string? TeamName, bool Refresh);

        public record RequestSquadHistoryCommand(string TeamCode, int SeasonId, string? TeamName, bool Refresh, string UserId)
            : Common.ICommand<SquadHistoryRequestResponse>;

        public record SquadHistoryRequestResponse(string ReportId, string Status);

        public class Validator : AbstractValidator<RequestSquadHistoryCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamCode).NotEmpty().MaximumLength(SquadHistoryReport.Rules.TeamCodeMaxLength);
                RuleFor(x => x.TeamName).MaximumLength(SquadHistoryReport.Rules.TeamNameMaxLength);
                RuleFor(x => x.SeasonId).GreaterThan(0);
                RuleFor(x => x.UserId).NotEmpty();
            }
        }

        public class Handler(FederationDbContext db, ISquadHistoryQueue queue, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<RequestSquadHistoryCommand, SquadHistoryRequestResponse>
        {
            public async ValueTask<SquadHistoryRequestResponse> Handle(RequestSquadHistoryCommand request, CancellationToken cancellationToken)
            {
                var teamCode = request.TeamCode.Trim();
                var existing = await FindAsync(teamCode, request.SeasonId, cancellationToken);

                if (existing == null)
                {
                    var created = SquadHistoryReport.Create(teamCode, request.TeamName ?? string.Empty, request.SeasonId,
                        PreviousSeasonId(request.SeasonId), request.UserId);
                    db.SquadHistoryReports.Add(created);
                    try
                    {
                        await db.SaveChangesAsync(cancellationToken);
                    }
                    catch (DbUpdateException)
                    {
                        // Otra petición concurrente creó el informe (índice único equipo+temporada).
                        db.Entry(created).State = EntityState.Detached;
                        existing = await FindAsync(teamCode, request.SeasonId, cancellationToken)
                                   ?? throw new InvalidOperationException("No se pudo crear el historial de plantilla.");
                        return await HandleExistingAsync(existing, request, cancellationToken);
                    }

                    await queue.EnqueueAsync(created.Id, cancellationToken);
                    return new SquadHistoryRequestResponse(created.Id, created.Status.Name);
                }

                return await HandleExistingAsync(existing, request, cancellationToken);
            }

            private async Task<SquadHistoryRequestResponse> HandleExistingAsync(SquadHistoryReport report,
                RequestSquadHistoryCommand request, CancellationToken cancellationToken)
            {
                var isReadyToView = report.Status == SquadHistoryStatus.Completed && !request.Refresh;
                if (isReadyToView)
                    return new SquadHistoryRequestResponse(report.Id, report.Status.Name);

                var mustEnqueue = report.RequestRefresh(request.UserId);
                await db.SaveChangesAsync(cancellationToken);
                if (mustEnqueue)
                    await queue.EnqueueAsync(report.Id, cancellationToken);

                return new SquadHistoryRequestResponse(report.Id, report.Status.Name);
            }

            private Task<SquadHistoryReport?> FindAsync(string teamCode, int seasonId, CancellationToken cancellationToken) =>
                db.SquadHistoryReports
                    .Include(r => r.Subscribers)
                    .SingleOrDefaultAsync(r => r.TeamCode == teamCode && r.SeasonId == seasonId, cancellationToken);

            private int? PreviousSeasonId(int seasonId) =>
                rffmOptions.Value.SelectableSeasons
                    .Where(s => s.Id < seasonId)
                    .OrderByDescending(s => s.Id)
                    .Select(s => (int?)s.Id)
                    .FirstOrDefault();
        }
    }
}
