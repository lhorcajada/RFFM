using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using FamilyMemberVO = RFFM.Api.Domain.ValueObjects.FamilyMember;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Creates a single family member/contact for a <see cref="TeamPlayer"/>.
    /// POST /api/catalog/teamplayer/{id}/family-members
    ///
    /// Unlike the sibling sub-resources SetPlayerSanction/SetPlayerInjury (inline Minimal API
    /// handlers), this uses Mediator ICommand/Handler/Validator (CQRS), per the openspec change
    /// player-family-members-crud design: real FluentValidation for name/lastName/relation/
    /// email/phone is warranted here, where the pre-existing bulk PUT (UpdateTeamPlayer.SetFamily)
    /// validates nothing. Authorization is still done via [Authorize(Roles = ...)] rather than
    /// IRequireFeaturePermission -- this is a coach-only sub-resource, no self-edit path exists
    /// for it (unlike UpdateTeamPlayer).
    /// </summary>
    public class CreateFamilyMember : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/teamplayer/{id}/family-members",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, CreateFamilyMemberRequest request, IMediator mediator, CancellationToken ct) =>
                    {
                        var response = await mediator.Send(new CreateFamilyMemberCommand(id, request), ct);
                        return Results.Created(
                            $"/api/catalog/teamplayer/{id}/family-members/{response.Id}",
                            response);
                    })
                .WithName(nameof(CreateFamilyMember))
                .WithTags(PlayerConstants.PlayerFeature)
                .Accepts<CreateFamilyMemberRequest>("application/json")
                .Produces<FamilyMemberResponse>(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record CreateFamilyMemberRequest(
            string? Name,
            string? LastName,
            int FamilyMemberId,
            string? Phone,
            string? Email,
            string? Dni);

        public record CreateFamilyMemberCommand(string TeamPlayerId, CreateFamilyMemberRequest Request)
            : RFFM.Api.Common.ICommand<FamilyMemberResponse>;

        public record FamilyMemberResponse(
            string Id,
            string? Name,
            string? LastName,
            string? Phone,
            string? Email,
            string? FamilyMember,
            string? Dni = null);

        public class Validator : AbstractValidator<CreateFamilyMemberCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamPlayerId).NotEmpty();
                RuleFor(x => x.Request.Name).NotEmpty().MaximumLength(100)
                    .WithMessage("El nombre es obligatorio.");
                RuleFor(x => x.Request.LastName).NotEmpty().MaximumLength(100)
                    .WithMessage("Los apellidos son obligatorios.");
                RuleFor(x => x.Request.FamilyMemberId)
                    .Must(id => FamilyMemberVO.FromId(id) != null)
                    .WithMessage("Parentesco desconocido.");
                RuleFor(x => x.Request.Email)
                    .EmailAddress()
                    .When(x => !string.IsNullOrWhiteSpace(x.Request.Email))
                    .WithMessage("El email no tiene un formato válido.");
                RuleFor(x => x.Request.Phone)
                    .Matches(@"^[+]?[0-9\s-]{6,15}$")
                    .When(x => !string.IsNullOrWhiteSpace(x.Request.Phone))
                    .WithMessage("El teléfono no tiene un formato válido.");
                RuleFor(x => x.Request.Dni).MaximumLength(20);
            }
        }

        public class Handler : IRequestHandler<CreateFamilyMemberCommand, FamilyMemberResponse>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<FamilyMemberResponse> Handle(CreateFamilyMemberCommand command, CancellationToken cancellationToken = default)
            {
                var teamPlayerExists = await _db.TeamPlayers
                    .AsNoTracking()
                    .AnyAsync(tp => tp.Id == command.TeamPlayerId, cancellationToken);

                if (!teamPlayerExists)
                    throw new NotFoundException($"TeamPlayer '{command.TeamPlayerId}' Not Found", ErrorCodes.TeamPlayerNotFound);

                var relation = FamilyMemberVO.FromId(command.Request.FamilyMemberId);

                var familyMember = TeamPlayerFamilyMember.Create(
                    command.TeamPlayerId,
                    command.Request.Name,
                    command.Request.LastName,
                    command.Request.Phone,
                    command.Request.Email,
                    command.Request.Dni,
                    relation?.Name);

                _db.TeamPlayerFamilyMembers.Add(familyMember);
                await _db.SaveChangesAsync(cancellationToken);

                return ToResponse(familyMember);
            }
        }

        internal static FamilyMemberResponse ToResponse(TeamPlayerFamilyMember f)
            => new(f.Id, f.Name, f.LastName, f.Phone, f.Email, f.FamilyMember, f.Dni);
    }
}
