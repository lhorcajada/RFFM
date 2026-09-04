using System.Linq;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Kits
{
    public class SaveClubKits : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/teams/{teamId}/kits",
                    async (string teamId, SaveClubKitsCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SaveClubKits))
                .WithTags("Kits")
                .Produces<GetTeamKits.ClubKitResponse[]>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Administrator,Coach,ClubDirector,ClubMember" });
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record SaveClubKitsCommand : IRequest<GetTeamKits.ClubKitResponse[]>
        {
            public string TeamId { get; set; } = null!;
            public List<SaveClubKitRequest> Kits { get; set; } = new();
        }

        public record SaveClubKitRequest
        {
            public int KitNumber { get; set; }
            public string ShirtColor { get; set; } = null!;
            public string ShortsColor { get; set; } = null!;
            public string SocksColor { get; set; } = null!;
        }

        // ─── Validator ────────────────────────────────────────────────────────

        public class Validator : AbstractValidator<SaveClubKitsCommand>
        {
            private static readonly System.Text.RegularExpressions.Regex HexColor =
                new(@"^#[0-9A-Fa-f]{6}$", System.Text.RegularExpressions.RegexOptions.Compiled);

            public Validator()
            {
                RuleFor(x => x.Kits)
                    .NotEmpty()
                    .Must(kits => kits.Count == 2).WithMessage("Se deben enviar exactamente 2 equipaciones.")
                    .Must(kits => kits.Select(k => k.KitNumber).OrderBy(n => n).SequenceEqual(new[] { 1, 2 }))
                        .WithMessage("Las equipaciones deben tener KitNumber 1 y 2, sin duplicados.");

                RuleForEach(x => x.Kits).ChildRules(kit =>
                {
                    kit.RuleFor(k => k.ShirtColor).NotEmpty().Matches(HexColor).WithMessage("ShirtColor debe tener formato #RRGGBB.");
                    kit.RuleFor(k => k.ShortsColor).NotEmpty().Matches(HexColor).WithMessage("ShortsColor debe tener formato #RRGGBB.");
                    kit.RuleFor(k => k.SocksColor).NotEmpty().Matches(HexColor).WithMessage("SocksColor debe tener formato #RRGGBB.");
                });
            }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<SaveClubKitsCommand, GetTeamKits.ClubKitResponse[]>
        {
            public async ValueTask<GetTeamKits.ClubKitResponse[]> Handle(SaveClubKitsCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var existingKits = await db.ClubKits
                    .Where(k => k.ClubId == team.ClubId && k.SeasonId == team.SeasonId)
                    .ToListAsync(cancellationToken);

                foreach (var kitRequest in request.Kits)
                {
                    var existing = existingKits.FirstOrDefault(k => k.KitNumber == kitRequest.KitNumber);

                    if (existing != null)
                    {
                        existing.UpdateColors(kitRequest.ShirtColor, kitRequest.ShortsColor, kitRequest.SocksColor);
                    }
                    else
                    {
                        var created = ClubKit.Create(
                            team.ClubId,
                            team.SeasonId,
                            kitRequest.KitNumber,
                            kitRequest.ShirtColor,
                            kitRequest.ShortsColor,
                            kitRequest.SocksColor);
                        db.ClubKits.Add(created);
                        existingKits.Add(created);
                    }
                }

                await db.SaveChangesAsync(cancellationToken);

                return existingKits
                    .OrderBy(k => k.KitNumber)
                    .Select(k => new GetTeamKits.ClubKitResponse(k.KitNumber, k.ShirtColor, k.ShortsColor, k.SocksColor))
                    .ToArray();
            }
        }
    }
}
