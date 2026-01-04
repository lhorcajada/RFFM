using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Assistances.Queries
{
    public class GetExcuseTypes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/excusetypes",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new ExcuseTypesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetExcuseTypes))
                .WithTags("ExcuseTypes")
                .RequireAuthorization()
                .Produces<ExcuseTypeResponse[]>();
        }

        public record ExcuseTypesQueryApp : Common.IQueryApp<ExcuseTypeResponse[]>;

        public record ExcuseTypeResponse(int Id, string Name);

        public class ExcuseTypesRequestHandler : IRequestHandler<ExcuseTypesQueryApp, ExcuseTypeResponse[]>
        {
            public ValueTask<ExcuseTypeResponse[]> Handle(ExcuseTypesQueryApp request, CancellationToken cancellationToken = default)
            {
                var items = ExcuseTypes.List()
                    .Select(e => new ExcuseTypeResponse(e.Id, e.Name))
                    .ToArray();

                return ValueTask.FromResult(items);
            }
        }
    }
}
