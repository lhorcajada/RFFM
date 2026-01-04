using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.UserClubs.Queries
{
    public class GetMemberships : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/memberships",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new MembershipsQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetMemberships))
                .WithTags("Memberships")
                .RequireAuthorization()
                .Produces<MembershipResponse[]>();
        }

        public record MembershipsQueryApp : Common.IQueryApp<MembershipResponse[]>;

        public record MembershipResponse(int Id, string Key, string Name);

        public class MembershipsRequestHandler : IRequestHandler<MembershipsQueryApp, MembershipResponse[]>
        {
            public ValueTask<MembershipResponse[]> Handle(MembershipsQueryApp request, CancellationToken cancellationToken = default)
            {
                var items = Membership.GetAll()
                    .Select(m => new MembershipResponse(m.Id, m.Key, m.Name))
                    .ToArray();

                return ValueTask.FromResult(items);
            }
        }
    }
}
