using System.Text.RegularExpressions;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    public class CreateTeamsBatch : IFeatureModule
    {
        public const int MaxLetters = 26;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/teams/batch",
                    async ([FromBody] CreateTeamsBatchRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new CreateTeamsBatchCommand(request), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(CreateTeamsBatch))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<CreateTeamsBatchResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record CreateTeamsBatchRequest(string ClubId, string SeasonId, int CategoryId, int? LeagueId, string[] Letters);

        public record CreateTeamsBatchCommand(CreateTeamsBatchRequest Request)
            : RFFM.Api.Common.ICommand<CreateTeamsBatchResponse>, IInvalidateCacheRequest, IRequireFeaturePermission
        {
            public string PrefixCacheKey => TeamConstants.CachePrefix;
            public string FeatureRoute => CoachFeatureRoutes.ClubTeams;
            public string RequiredPermission => "ReadWrite";
        }

        public record CreatedTeamDto(string Id, string Name);

        public record CreateTeamsBatchResponse(CreatedTeamDto[] Created, string[] Skipped);

        public class Validator : AbstractValidator<CreateTeamsBatchCommand>
        {
            private static readonly Regex SingleLetter = new("^[A-Za-z]$", RegexOptions.Compiled);

            public Validator()
            {
                RuleFor(x => x.Request.ClubId).NotEmpty();
                RuleFor(x => x.Request.SeasonId).NotEmpty();
                RuleFor(x => x.Request.CategoryId).GreaterThan(0);
                RuleFor(x => x.Request.Letters)
                    .NotNull()
                    .NotEmpty()
                    .Must(letters => letters.Length <= MaxLetters)
                    .WithMessage($"No se pueden crear más de {MaxLetters} equipos a la vez.")
                    .Must(letters => letters.All(l => l is not null && SingleLetter.IsMatch(l)))
                    .WithMessage("Cada letra debe ser un único carácter de la A a la Z.")
                    .Must(letters => letters.Select(l => l?.ToUpperInvariant()).Distinct().Count() == letters.Length)
                    .WithMessage("Las letras no pueden repetirse.");
            }
        }

        public class Handler(AppDbContext db) : IRequestHandler<CreateTeamsBatchCommand, CreateTeamsBatchResponse>
        {
            public async ValueTask<CreateTeamsBatchResponse> Handle(CreateTeamsBatchCommand command, CancellationToken cancellationToken)
            {
                var request = command.Request;

                var category = await db.Categories.AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
                if (category is null)
                {
                    throw new DomainException("Equipos", "La categoría indicada no existe.", ErrorCodes.CategoryNotFound);
                }

                var existingNames = await db.Teams.AsNoTracking()
                    .Where(t => t.ClubId == request.ClubId && t.SeasonId == request.SeasonId)
                    .Select(t => t.Name)
                    .ToListAsync(cancellationToken);
                var existing = existingNames
                    .Select(Normalize)
                    .ToHashSet();

                var skipped = new List<string>();
                var toCreate = new List<Team>();
                foreach (var letter in request.Letters)
                {
                    var name = $"{category.Name} {letter.Trim().ToUpperInvariant()}";
                    if (existing.Contains(Normalize(name)))
                    {
                        skipped.Add(name);
                        continue;
                    }

                    toCreate.Add(new Team(new TeamModel
                    {
                        Name = name,
                        ClubId = request.ClubId,
                        CategoryId = request.CategoryId,
                        LeagueId = request.LeagueId,
                        SeasonId = request.SeasonId,
                        UrlPhoto = null
                    }));
                }

                if (toCreate.Count > 0)
                {
                    await db.Teams.AddRangeAsync(toCreate, cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);
                }

                return new CreateTeamsBatchResponse(
                    toCreate.Select(t => new CreatedTeamDto(t.Id, t.Name)).ToArray(),
                    skipped.ToArray());
            }

            private static string Normalize(string name) => name.Trim().ToUpperInvariant();
        }
    }
}
