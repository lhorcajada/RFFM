using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Assistances.Queries
{
    public class GetConvocationStatuses : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/convocationstatuses",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new ConvocationStatusesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetConvocationStatuses))
                .WithTags("ConvocationStatuses")
                .RequireAuthorization()
                .Produces<ConvocationStatusResponse[]>();
        }

        public record ConvocationStatusesQueryApp : Common.IQueryApp<ConvocationStatusResponse[]>;

        public record ConvocationStatusResponse(int Id, string Name);

        public class ConvocationStatusesRequestHandler : IRequestHandler<ConvocationStatusesQueryApp, ConvocationStatusResponse[]>
        {
            public ValueTask<ConvocationStatusResponse[]> Handle(ConvocationStatusesQueryApp request, CancellationToken cancellationToken = default)
            {
                var items = ConvocationStatus.List()
                    .Select(s => new ConvocationStatusResponse(s.Id, s.Name))
                    .ToArray();

                return ValueTask.FromResult(items);
            }
        }
    }
}
