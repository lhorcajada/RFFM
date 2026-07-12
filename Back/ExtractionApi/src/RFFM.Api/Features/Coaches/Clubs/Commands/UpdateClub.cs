using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Clubs.Commands
{
    public class UpdateClub : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/catalog/club/{id}",
                    async (
                        string id, 
                        [FromForm] UpdateClubRequest request, 
                        [FromServices] IMediator mediator, 
                        CancellationToken cancellationToken) =>
                    {
                        var command = new UpdateClubCommand
                        {
                            ClubId = id,
                            ClubName = request.ClubName,
                            CountryCode = request.CountryCode,
                            Emblem = request.Emblem
                        };
                      
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateClub))
                .WithTags(ClubConstants.ClubFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization()
                .DisableAntiforgery();
        }
    }

    public class UpdateClubRequest
    {
        public IFormFile Emblem { get; set; }
        public string ClubName { get; set; } 
        public string CountryCode { get; set; }
    }

    public class UpdateClubCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public string ClubId { get; set; } = string.Empty;
        public string ClubName { get; set; } = string.Empty;
        public string CountryCode { get; set; } = string.Empty;
        public IFormFile? Emblem { get; set; } // Archivo opcional para la imagen del club.

        public string PrefixCacheKey => ClubConstants.CachePrefix;
        public string FeatureRoute => "/coach/clubs";
        public string RequiredPermission => "Write";
    }

    public class UpdateClubHandler : IRequestHandler<UpdateClubCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;
        private readonly IStorageService _storageService;

        public UpdateClubHandler(AppDbContext catalogDbContext, IStorageService storageService)
        {
            _catalogDbContext = catalogDbContext;
            _storageService = storageService;
        }

        public async ValueTask<Unit> Handle(UpdateClubCommand request, CancellationToken cancellationToken)
        {
            var club = await _catalogDbContext.Clubs
                .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken: cancellationToken);
            if (club == null)
                throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

            var country = await _catalogDbContext
                .Countries
                .FirstOrDefaultAsync(c => c.Code == request.CountryCode, cancellationToken: cancellationToken);
            if (country == null)
                throw new KeyNotFoundException($"Country '{request.CountryCode}' Not Found");

            var emblemUrl = club.ShieldUrl;

            if (request.Emblem != null && request.Emblem.Length > 0)
            {
                var fileName = Guid.NewGuid() + Path.GetExtension(request.Emblem.FileName);
                emblemUrl = await _storageService.UploadAsync(ClubConstants.ClubsContainerName, fileName, request.Emblem, cancellationToken);
            }

            club.UpdateName(request.ClubName);
            club.UpdateCountry(country.Id);
            club.UpdateShieldUrl(emblemUrl);
            club.UpdateInvitationCode(club.InvitationCode);

            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }

    public class UpdateClubValidator : AbstractValidator<UpdateClubCommand>
    {
        public UpdateClubValidator()
        {
            RuleFor(r => r.ClubId)
                .NotEmpty()
                .MaximumLength(ValidationConstants.ClubNameMaxLength);
        }
    }
}
