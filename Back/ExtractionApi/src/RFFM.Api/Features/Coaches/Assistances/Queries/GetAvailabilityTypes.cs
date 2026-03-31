using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Assistances.Queries
{
    public class GetAvailabilityTypes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/availabilitytypes",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new AvailabilityTypesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetAvailabilityTypes))
                .WithTags("AvailabilityTypes")
                .RequireAuthorization()
                .Produces<AvailabilityTypeResponse[]>();
        }

        public record AvailabilityTypesQueryApp : Common.IQueryApp<AvailabilityTypeResponse[]>;

        public record AvailabilityTypeResponse(int Id, string Name);

        public class AvailabilityTypesRequestHandler : IRequestHandler<AvailabilityTypesQueryApp, AvailabilityTypeResponse[]>
        {
            public ValueTask<AvailabilityTypeResponse[]> Handle(AvailabilityTypesQueryApp request, CancellationToken cancellationToken = default)
            {
                var items = AvailabilityType.List()
                    .Select(a => new AvailabilityTypeResponse(a.Id, a.Name))
                    .ToArray();

                return ValueTask.FromResult(items);
            }
        }
    }
}
