using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Domain.Entities.Demarcations;
using System.Linq;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetDemarcations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/demarcations",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new Query(), cancellationToken);
                    })
                .WithName(nameof(GetDemarcations))
                .WithTags("Demarcations")
                .Produces<DemarcationResponse[]>();
        }

        public record Query() : Common.IQueryApp<DemarcationResponse[]>;

        public record DemarcationResponse(int Id, string Name, string Code);

        public class RequestHandler : IRequestHandler<Query, DemarcationResponse[]>
        {
            public ValueTask<DemarcationResponse[]> Handle(Query request, CancellationToken cancellationToken = default)
            {
                var list = DemarcationMaster.List()
                    .Select(d => new DemarcationResponse(d.Id, d.Name, d.Code))
                    .ToArray();

                return ValueTask.FromResult(list);
            }
        }
    }
}
