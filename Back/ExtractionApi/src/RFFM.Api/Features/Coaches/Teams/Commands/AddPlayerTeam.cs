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
            public string Name { get; set; } = null!;
            public string? LastName { get; set; } = null!;
            public string Alias { get; set; } = null!;
            public IFormFile? PhotoFile { get; set; }
            public DateTime? BirthDate { get; set; }
            public string? Dni { get; set; }
            public string ClubId { get; set; } = null!;
            public DemarcationModel? Demarcation { get; set; } = null!;
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
                var player = await CreatePlayerIfNotExist(request, cancellationToken);

                await ValidateExistingTeam(request, cancellationToken);

                await ValidatePlayerAlreadyInTeam(request, cancellationToken);

                var team = TeamPlayer.Create(new TeamPlayerModel
                {
                    PlayerId = player.Id,
                    TeamId = request.TeamId,
                    JoinedDate = DateTime.UtcNow.Date,
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
                var player = await _catalogDbContext.Players
                                 .FirstOrDefaultAsync(p => p.Id == request.PlayerId, cancellationToken)
                             ?? await _playerService.AddPlayerClub(new CreatePlayerModel
                             {
                                 Name = request.Name,
                                 ClubId = request.ClubId,
                                 Alias = request.Alias,
                                 BirthDate = request.BirthDate,
                                 Dni = request.Dni,
                                 LastName = request.LastName,
                                 PhotoFile = request.PhotoFile
                             }, cancellationToken);
                return player;
            }

            private async Task ValidatePlayerAlreadyInTeam(AddPlayerCommand request, CancellationToken cancellationToken)
            {
                var alreadyInTeam = await _catalogDbContext.TeamPlayers
                    .AnyAsync(tp => tp.PlayerId == request.PlayerId && tp.TeamId == request.TeamId && tp.LeftDate == null, cancellationToken);

                if (alreadyInTeam)
                    throw new DomainException("TeamPlayer", $"Player '{request.PlayerId}' is already in Team '{request.TeamId}'", "PlayerAlreadyInTeam");
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
