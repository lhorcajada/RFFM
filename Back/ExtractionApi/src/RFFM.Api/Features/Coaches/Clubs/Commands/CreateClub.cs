using Azure.Storage.Blobs;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Auth;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Clubs.Commands
{
    public class CreateClub : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/club",
                    async (
                        [FromForm] CreateClubRequest request,
                        [FromServices] IMediator mediator,
                        HttpContext httpContext,
                        CancellationToken cancellationToken) =>
                    {
                        var command = new CreateClubCommand
                        {
                            Name = request.Name,
                            CountryCode = request.CountryCode,
                            UserId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty,
                            Emblem = request.Emblem
                        };

                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(CreateClub))
                .WithTags(ClubConstants.ClubFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization()
                .DisableAntiforgery();
        }
    }

    public class CreateClubRequest
    {
        public string Name { get; set; }
        public string CountryCode { get; set; }
        public IFormFile? Emblem { get; set; }
        public int RoleId { get; set; }
    }

    public class CreateClubCommand : IRequest, IInvalidateCacheRequest
    {
        public string CountryCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string UserId { get; set; }
        public IFormFile? Emblem { get; set; }

        public string PrefixCacheKey => ClubConstants.CachePrefix;
    }

    public class CreateClubHandler : IRequestHandler<CreateClubCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;
        private readonly BlobServiceClient _blobServiceClient;

        public CreateClubHandler(AppDbContext catalogDbContext, BlobServiceClient blobServiceClient)
        {
            _catalogDbContext = catalogDbContext;
            _blobServiceClient = blobServiceClient;
        }

        public async ValueTask<Unit> Handle(CreateClubCommand request, CancellationToken cancellationToken)
        {
            var country = await _catalogDbContext
                .Countries
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == request.CountryCode, cancellationToken: cancellationToken);
            if (country == null)
                throw new KeyNotFoundException($"Country '{request.CountryCode}' Not Found");

            string? emblemUrl = null;

            if (request.Emblem != null && request.Emblem.Length > 0)
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(ClubConstants.ClubsContainerName);
                await containerClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

                var fileName = Guid.NewGuid() + Path.GetExtension(request.Emblem.FileName);
                var blobClient = containerClient.GetBlobClient(fileName);

                await using var stream = request.Emblem.OpenReadStream();
                await blobClient.UploadAsync(stream, cancellationToken);

                emblemUrl = blobClient.Uri.ToString();
            }

            var club = new Club(request.Name, country.Id);
            club.UpdateShieldUrl(emblemUrl);
            var entryClub = await _catalogDbContext.Clubs.AddAsync(club, cancellationToken);
            var userClub = new UserClub(request.UserId, entryClub.Entity.Id, Membership.Coach.Id);
            await _catalogDbContext.UserClubs.AddAsync(userClub, cancellationToken);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }

    public class CreateValidator : AbstractValidator<CreateClubCommand>
    {
        public CreateValidator()
        {
            RuleFor(r => r.Name)
                .NotEmpty()
                .MaximumLength(ValidationConstants.ClubNameMaxLength);
            RuleFor(r => r.CountryCode)
                .NotEmpty()
                .MaximumLength(ValidationConstants.CountryCodeMaxLength);
        }
    }
}
