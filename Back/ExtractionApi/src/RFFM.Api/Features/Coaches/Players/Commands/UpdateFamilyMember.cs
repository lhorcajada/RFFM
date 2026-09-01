using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using FamilyMemberVO = RFFM.Api.Domain.ValueObjects.FamilyMember;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Updates a single family member/contact of a <see cref="Domain.Entities.TeamPlayers.TeamPlayer"/>.
    /// PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}
    ///
    /// openspec change player-family-member-update: follow-up to
    /// player-family-members-crud (CreateFamilyMember.cs/DeleteFamilyMember.cs), which left
    /// individual editing out of scope. Reuses
    /// <see cref="Domain.Entities.TeamPlayers.TeamPlayerFamilyMember.UpdateDetails"/>, already
    /// used internally by the bulk PUT (TeamPlayer.SetFamily), and
    /// <see cref="CreateFamilyMember.FamilyMemberResponse"/>/<see cref="CreateFamilyMember.ToResponse"/>
    /// to avoid duplicating an identical response shape.
    /// </summary>
    public class UpdateFamilyMember : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/catalog/teamplayer/{id}/family-members/{familyMemberId}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, string familyMemberId, UpdateFamilyMemberRequest request, IMediator mediator, CancellationToken ct) =>
                    {
                        var response = await mediator.Send(new UpdateFamilyMemberCommand(id, familyMemberId, request), ct);
                        return Results.Ok(response);
                    })
                .WithName(nameof(UpdateFamilyMember))
                .WithTags(PlayerConstants.PlayerFeature)
                .Accepts<UpdateFamilyMemberRequest>("application/json")
                .Produces<CreateFamilyMember.FamilyMemberResponse>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateFamilyMemberRequest(
            string? Name,
            string? LastName,
            int FamilyMemberId,
            string? Phone,
            string? Email,
            string? Dni);

        public record UpdateFamilyMemberCommand(string TeamPlayerId, string FamilyMemberId, UpdateFamilyMemberRequest Request)
            : RFFM.Api.Common.ICommand<CreateFamilyMember.FamilyMemberResponse>;

        public class Validator : AbstractValidator<UpdateFamilyMemberCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamPlayerId).NotEmpty();
                RuleFor(x => x.FamilyMemberId).NotEmpty();
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

        public class Handler : IRequestHandler<UpdateFamilyMemberCommand, CreateFamilyMember.FamilyMemberResponse>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<CreateFamilyMember.FamilyMemberResponse> Handle(UpdateFamilyMemberCommand command, CancellationToken cancellationToken = default)
            {
                var familyMember = await _db.TeamPlayerFamilyMembers
                    .FirstOrDefaultAsync(f => f.Id == command.FamilyMemberId && f.TeamPlayerId == command.TeamPlayerId, cancellationToken);

                if (familyMember is null)
                    throw new NotFoundException($"FamilyMember '{command.FamilyMemberId}' Not Found", ErrorCodes.FamilyMemberNotFound);

                var relation = FamilyMemberVO.FromId(command.Request.FamilyMemberId);

                familyMember.UpdateDetails(
                    command.Request.Name,
                    command.Request.LastName,
                    command.Request.Phone,
                    command.Request.Email,
                    command.Request.Dni,
                    relation?.Name,
                    familyMember.Address);

                await _db.SaveChangesAsync(cancellationToken);

                return CreateFamilyMember.ToResponse(familyMember);
            }
        }
    }
}
