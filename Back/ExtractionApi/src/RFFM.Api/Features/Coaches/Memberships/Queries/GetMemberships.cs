using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Memberships.Queries
{
    public class GetMemberships : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/roles", async (HttpContext httpContext, IMediator mediator) =>
                {
                    // Extraer el token del encabezado de autorización
                    var userId = httpContext.User.Claims.FirstOrDefault(c =>
                        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                    if (string.IsNullOrEmpty(userId))
                    {
                        return Results.Unauthorized();
                    }

                    // Enviar la consulta con el userId al handler
                    var result = await mediator.Send(new MembershipQuery(userId));
                    return Results.Ok(result);
                })
                .WithName(nameof(GetMemberships))
                .WithTags(MembershipConstants.RoleFeature)
                .Produces<MembershipResponse[]>()
                .RequireAuthorization();
        }

        public record MembershipQuery(string UserId) : IQueryApp<MembershipResponse[]>;

        public record MembershipResponse(int Id, string Name, string Key, bool IsAssigned);

        public class MembershipRequestHandler : IRequestHandler<MembershipQuery, MembershipResponse[]>
        {
            private readonly AppDbContext _db;

            public MembershipRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<MembershipResponse[]> Handle(MembershipQuery request, CancellationToken cancellationToken = default)
            {
                // Recuperar todos los roles
                var roles = await _db.Roles
                    .Select(role => new
                    {
                        role.Id,
                        role.Name,
                        IsAssigned = _db.UserClubs.Any(ur => ur.RoleId == role.Id && ur.ApplicationUserId == request.UserId),
                        role.Key
                    })
                    .ToListAsync(cancellationToken);

                // Mapear a la respuesta
                return roles.Select(role => new MembershipResponse(role.Id, role.Name, role.Key, role.IsAssigned)).ToArray();
            }
        }
    }
}
