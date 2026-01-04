using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Roles.Queries
{
    public class Roles : IFeatureModule
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
                    var result = await mediator.Send(new RolesQuery(userId));
                    return Results.Ok(result);
                })
                .WithName(nameof(Roles))
                .WithTags(RolesConstants.RoleFeature)
                .Produces<RolesResponse[]>()
                .RequireAuthorization();
        }

        public record RolesQuery(string UserId) : IQueryApp<RolesResponse[]>;

        public record RolesResponse(int Id, string Name, string Key, bool IsAssigned);

        public class RolesRequestHandler : IRequestHandler<RolesQuery, RolesResponse[]>
        {
            private readonly AppDbContext _db;
                    
            public RolesRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<RolesResponse[]> Handle(RolesQuery request, CancellationToken cancellationToken = default)
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
                return roles.Select(role => new RolesResponse(role.Id, role.Name, role.Key, role.IsAssigned)).ToArray();
            }
        }
    }
}
