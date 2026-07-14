using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using Microsoft.Extensions.Logging;
using System.Linq;
using Azure.Core;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.SeasonAccess;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public class UpsertSeasonAccessPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/season-access/players",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (UpsertSeasonAccessPlayerRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new UpsertSeasonAccessPlayerCommand(request), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UpsertSeasonAccessPlayer))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDto>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpsertSeasonAccessPlayerCommand(UpsertSeasonAccessPlayerRequest Request) : RFFM.Api.Common.ICommand<SeasonAccessTrialDto?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonAccess;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<UpsertSeasonAccessPlayerCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Request.SeasonId).NotEmpty();
                RuleFor(x => x.Request.Category).NotEmpty();
                RuleFor(x => x.Request.FederationPlayerCode).NotEmpty();
                RuleFor(x => x.Request.PlayerName).NotEmpty();
                RuleFor(x => x.Request.TeamCode).NotEmpty();
                RuleFor(x => x.Request.TeamName).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<UpsertSeasonAccessPlayerCommand, SeasonAccessTrialDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly ILogger<Handler> _logger;

            public Handler(AppDbContext db, ICurrentUserService currentUser, ILogger<Handler> logger)
            {
                _db = db;
                _currentUser = currentUser;
                _logger = logger;
            }

            public async ValueTask<SeasonAccessTrialDto?> Handle(UpsertSeasonAccessPlayerCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                var request = command.Request;
                var trialCategory = SeasonAccessCategoryHelper.ExtractGeneralCategory(request.Category);

                var trial = await _db.SeasonAccessTrials
                    .Include(x => x.Players)
                    .FirstOrDefaultAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category.ToUpper() == trialCategory.ToUpper(),
                        cancellationToken);

                if (trial is null)
                {
                    trial = SeasonAccessTrial.Create(userId, request.SeasonId, trialCategory);
                    _db.SeasonAccessTrials.Add(trial);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                var player = trial.Players.FirstOrDefault(x => x.FederationPlayerCode == request.FederationPlayerCode);
                if (player is null)
                {
                    // Defensive: sometimes the client mistakenly sends the trial player's Id
                    // as the `FederationPlayerCode`. Try to match by Id before creating a new row.
                    var byId = trial.Players.FirstOrDefault(x => x.Id == request.FederationPlayerCode);
                    if (byId != null)
                    {
                        player = byId;
                        try
                        {
                            _logger.LogInformation("UpsertSeasonAccessPlayer: interpreted FederationPlayerCode '{FederationPlayerCode}' as existing player Id '{PlayerId}' and will update", request.FederationPlayerCode, player.Id);
                        }
                        catch { }
                    }
                }

                if (player is null)
                {
                    var playerCategory = string.IsNullOrWhiteSpace(request.DivisionCategory) ? request.Category : request.DivisionCategory?.Trim();
                    player = SeasonAccessTrialPlayer.Create(
                        trial.Id,
                        request.FederationPlayerCode,
                        request.PlayerName,
                        request.TeamCode,
                        request.TeamName,
                        string.IsNullOrWhiteSpace(playerCategory) ? string.Empty : playerCategory.Trim(),
                        request.BirthYear,
                        request.PossibleDemarcationIds,
                        request.IdealDemarcationId,
                        request.TotalGoals,
                        request.Status,
                        request.Score,
                        request.Notes,
                        request.TrialDayId);

                    trial.Players.Add(player);
                    _db.SeasonAccessTrialPlayers.Add(player);
                }
                else
                {
                    var playerCategory = string.IsNullOrWhiteSpace(request.DivisionCategory) ? request.Category : request.DivisionCategory?.Trim();
                    player.Update(
                        trial.Id,
                        request.FederationPlayerCode,
                        request.PlayerName,
                        request.TeamCode,
                        request.TeamName,
                        string.IsNullOrWhiteSpace(playerCategory) ? string.Empty : playerCategory.Trim(),
                        request.BirthYear,
                        request.PossibleDemarcationIds,
                        request.IdealDemarcationId,
                        request.TotalGoals,
                        request.Status,
                        request.Score,
                        request.Notes,
                        request.TrialDayId);
                }

                // If the client provided a TrialDayId we are (re)adding the player to a day —
                // clear any previous RemovedFromDate so the player becomes active again.
                if (!string.IsNullOrWhiteSpace(request.TrialDayId))
                {
                    try
                    {
                        player.SetRemovedFromDate(null);
                    }
                    catch { }
                }

                await _db.SaveChangesAsync(cancellationToken);

                var refreshed = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .Include(x => x.Players)
                    .FirstAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category.ToUpper() == request.Category.ToUpper(),
                        cancellationToken);

                try
                {
                    var playersInfo = string.Join(", ", refreshed.Players.Select(p => $"{p.FederationPlayerCode}|{p.PlayerName}|{p.TeamCode}"));
                    _logger.LogInformation("UpsertSeasonAccessPlayer: user {UserId} season {SeasonId} trialCategory {TrialCategory} playerDivisionCategory {PlayerDivisionCategory} request player {FederationPlayerCode} -> returning players: {Players}", userId, request.SeasonId, trialCategory, request.DivisionCategory ?? request.Category, request.FederationPlayerCode, playersInfo);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to log UpsertSeasonAccessPlayer players");
                }

                return refreshed.ToDto();
            }
        }
    }
}