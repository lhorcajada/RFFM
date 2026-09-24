using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Notifications
{
    public class GetVapidPublicKey : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/push/vapid-public-key",
                    async (IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new VapidPublicKeyQuery(), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetVapidPublicKey))
                .WithTags("Notifications")
                .Produces<VapidPublicKeyResponse>()
                .RequireAuthorization();
        }

        public record VapidPublicKeyQuery : IRequest<VapidPublicKeyResponse>;

        public record VapidPublicKeyResponse(string PublicKey);

        public class Handler : IRequestHandler<VapidPublicKeyQuery, VapidPublicKeyResponse>
        {
            private readonly IConfiguration _configuration;
            public Handler(IConfiguration configuration) => _configuration = configuration;

            public ValueTask<VapidPublicKeyResponse> Handle(VapidPublicKeyQuery request, CancellationToken cancellationToken = default)
            {
                var publicKey = _configuration["WebPush:PublicKey"] ?? string.Empty;
                return new ValueTask<VapidPublicKeyResponse>(new VapidPublicKeyResponse(publicKey));
            }
        }
    }
}
