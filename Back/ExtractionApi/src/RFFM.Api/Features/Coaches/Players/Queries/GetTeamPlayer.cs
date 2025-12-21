using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.ValueObjects.Player;
using RFFM.Api.Domain.ValueObjects;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetTeamPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/teamplayer/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new TeamPlayerQuery { TeamPlayerId = id }, cancellationToken);
                    })
                .WithName(nameof(GetTeamPlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<TeamPlayerResponse>();
        }

        public record TeamPlayerQuery : IQueryApp<TeamPlayerResponse>
        {
            public string TeamPlayerId { get; set; } = null!;
        }

        public record AddressResponse(string? Street, string? City, string? Province, string? PostalCode, string? Country);
        public record ContactInfoResponse(AddressResponse? Address, string? Phone, string? Email);
        public record PhysicalInfoResponse(decimal? Height, decimal? Weight, string? DominantFoot);
        public record DemarcationResponse(int? ActivePositionId, string? ActivePositionName, string[] PossibleDemarcations);
        public record FamilyResponse(string? Name, string? Phone, string? Email, string? FamilyMember);

        public record TeamPlayerResponse(
            string Id,
            string PlayerId,
            PlayerModel Player,
            string TeamId,
            DateTime JoinedDate,
            DateTime? LeftDate,
            int? Dorsal,
            DemarcationResponse? Demarcation,
            ContactInfoResponse? ContactInfo,
            PhysicalInfoResponse? PhysicalInfo,
            FamilyResponse[] FamilyMembers
        );

        public class RequestHandler : IRequestHandler<TeamPlayerQuery, TeamPlayerResponse>
        {
            private readonly AppDbContext _db;

            public RequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<TeamPlayerResponse> Handle(TeamPlayerQuery request, CancellationToken cancellationToken = default)
            {
                var item = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .FirstOrDefaultAsync(tp => tp.Id == request.TeamPlayerId, cancellationToken);

                if (item == null)
                    throw new KeyNotFoundException($"TeamPlayer '{request.TeamPlayerId}' Not Found");

                // map PlayerModel
                var playerModel = new PlayerModel
                {
                    Id = item.Player.Id,
                    Alias = item.Player.Alias,
                    Name = item.Player.Name,
                    LastName = item.Player.LastName,
                    BirthDate = item.Player.BirthDate,
                    Dni = item.Player.Dni,
                    UrlPhoto = item.Player.UrlPhoto,
                    ClubId = item.Player.ClubId
                };

                // dorsal
                int? dorsal = item.Dorsal?.Number;

                // demarcation mapping
                DemarcationResponse? demarcationResp = null;
                if (item.Demarcation != null)
                {
                    var active = item.Demarcation.GetActivePosition();
                    var possible = item.Demarcation.GetPossibleDemarcations()?.Select(d => d?.Name ?? string.Empty).Where(n => !string.IsNullOrEmpty(n)).ToArray() ?? Array.Empty<string>();
                    demarcationResp = new DemarcationResponse(item.Demarcation.ActivePositionId, active?.Name, possible);
                }

                // contact info
                ContactInfoResponse? contact = null;
                if (item.ContactInfo != null)
                {
                    var addr = item.ContactInfo.Address;
                    var addrResp = addr != null ? new AddressResponse(addr.Street, addr.City, addr.Province, addr.PostalCode, addr.Country) : null;
                    contact = new ContactInfoResponse(addrResp, item.ContactInfo.Phone, item.ContactInfo.Email);
                }

                // physical info
                PhysicalInfoResponse? phys = null;
                if (item.PhysicalInfo != null)
                {
                    var foot = item.PhysicalInfo.DominantFoot;
                    phys = new PhysicalInfoResponse(item.PhysicalInfo.Height, item.PhysicalInfo.Weight, foot?.Name);
                }

                // family members mapping
                var fams = (item.FamilyMembers ?? new List<Family>())
                    .Select(f => new FamilyResponse(f.Name, f.Phone, f.Email, f.FamilyMember))
                    .ToArray();

                return new TeamPlayerResponse(
                    item.Id,
                    item.PlayerId,
                    playerModel,
                    item.TeamId,
                    item.JoinedDate,
                    item.LeftDate,
                    dorsal,
                    demarcationResp,
                    contact,
                    phys,
                    fams
                );
            }
        }
    }
}
