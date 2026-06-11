using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    public class AddPlayerTeam : IFeatureModule
    {
        public void AddRoutes(Microsoft.AspNetCore.Routing.IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/team/add-player",
                    async ([FromForm] AddPlayerCommand request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(AddPlayerTeam))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .DisableAntiforgery();
        }

        public class AddPlayerCommand : IRequest, IInvalidateCacheRequest
        {
            public string TeamId { get; set; } = null!;
            public string? PlayerId { get; set; } = null!;
            public string? SeasonId { get; set; }
            public int? Age { get; set; }
            public int? BirthYear { get; set; }
            public string? TeamName { get; set; }
            public string? TeamCategory { get; set; }
            public string Name { get; set; } = null!;
            public string? LastName { get; set; } = null!;
            public string Alias { get; set; } = null!;
            public IFormFile? PhotoFile { get; set; }
            public DateTime? BirthDate { get; set; }
            public string? Dni { get; set; }
            public string ClubId { get; set; } = null!;
            public DemarcationModel? Demarcation { get; set; } = null!;
            // Flat fallback: used when Demarcation complex binding is not available (e.g. import)
            public int? DemarcationActivePositionId { get; set; }
            public int? DomainFeetId { get; set; }
            public int? Dorsal { get; set; }
            public decimal? Height { get; set; }
            public decimal? Weight { get; set; }
            public ContactModel? Contact { get; set; }
            // Accept multiple family members
            public List<FamilyModel>? FamilyMembers { get; set; }


            public string PrefixCacheKey => PlayerConstants.CachePrefix;
        }

        public class AddPlayerHandler : IRequestHandler<AddPlayerCommand, Unit>
        {
            private readonly AppDbContext _catalogDbContext;
            private readonly IPlayerService _playerService;

            public AddPlayerHandler(AppDbContext catalogDbContext, IPlayerService playerService)
            {
                _catalogDbContext = catalogDbContext;
                _playerService = playerService;
            }
            public async ValueTask<Unit> Handle(AddPlayerCommand request, CancellationToken cancellationToken)
            {
                // Normalize: if Demarcation is null but flat id was sent, build the model
                if (request.Demarcation == null && request.DemarcationActivePositionId.HasValue)
                {
                    request.Demarcation = new DemarcationModel
                    {
                        ActivePositionId = request.DemarcationActivePositionId.Value,
                        PossibleDemarcations = new List<int> { request.DemarcationActivePositionId.Value }
                    };
                }
                var player = await CreatePlayerIfNotExist(request, cancellationToken);

                await ValidateExistingTeam(request, cancellationToken);

                // If player already in team → update demarcation and return
                var existing = await _catalogDbContext.TeamPlayers
                    .FirstOrDefaultAsync(
                        tp => tp.PlayerId == player.Id && tp.TeamId == request.TeamId && tp.LeftDate == null,
                        cancellationToken);

                if (existing != null)
                {
                    existing.SetSeasonId(request.SeasonId);
                    existing.SetAge(request.Age);
                    existing.SetBirthYear(request.BirthYear);
                    existing.SetTeamName(request.TeamName);
                    existing.SetTeamCategory(request.TeamCategory);
                    if (request.Demarcation != null)
                        existing.SetDemarcation(request.Demarcation);
                    await _catalogDbContext.SaveChangesAsync(cancellationToken);
                    return Unit.Value;
                }

                var team = TeamPlayer.Create(new TeamPlayerModel
                {
                    PlayerId = player.Id,
                    TeamId = request.TeamId,
                    SeasonId = request.SeasonId,
                    Age = request.Age,
                    BirthYear = request.BirthYear,
                    TeamName = request.TeamName,
                    TeamCategory = request.TeamCategory,
                    JoinedDate = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc),
                    LeftDate = null,
                    Demarcation = request.Demarcation,
                    ContactInfo = request.Contact,
                    Dorsal = request.Dorsal != null ? new DorsalModel { Number = request.Dorsal.Value } : null,
                    Height = request.Height,
                    Weight = request.Weight,
                    FamilyMembers = request.FamilyMembers ?? new List<FamilyModel>(),
                    DominantFootId = request.DomainFeetId
                });
                await _catalogDbContext.TeamPlayers.AddAsync(team, cancellationToken);
                await _catalogDbContext.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }

            private async Task<Player> CreatePlayerIfNotExist(AddPlayerCommand request, CancellationToken cancellationToken)
            {
                // 1. Try lookup by internal Coach DB id (manual flow)
                if (!string.IsNullOrEmpty(request.PlayerId))
                {
                    var byId = await _catalogDbContext.Players
                        .FirstOrDefaultAsync(p => p.Id == request.PlayerId, cancellationToken);
                    if (byId != null) return byId;
                }

                // 2. Look up by alias + club to prevent duplicate-key on re-import
                var alias = request.Alias?.Trim();
                if (!string.IsNullOrEmpty(alias) && !string.IsNullOrEmpty(request.ClubId))
                {
                    var byAlias = await _catalogDbContext.Players
                        .FirstOrDefaultAsync(p => p.Alias == alias && p.ClubId == request.ClubId, cancellationToken);
                    if (byAlias != null) return byAlias;
                }

                // 3. Create new player
                return await _playerService.AddPlayerClub(new CreatePlayerModel
                {
                    Name = request.Name,
                    ClubId = request.ClubId,
                    Alias = request.Alias,
                    BirthDate = request.BirthDate,
                    Dni = request.Dni,
                    LastName = request.LastName,
                    PhotoFile = request.PhotoFile
                }, cancellationToken);
            }

            private async Task ValidateExistingTeam(AddPlayerCommand request, CancellationToken cancellationToken)
            {
                var teamExists = await _catalogDbContext.Teams
                    .AnyAsync(t => t.Id == request.TeamId, cancellationToken);
                if (!teamExists)
                    throw new KeyNotFoundException($"Team '{request.TeamId}' Not Found");
            }

            
        }
    }


}
