using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.AiSettings.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.AiSettings
{
    /// <summary>
    /// Adds an AI provider for the current user. POST /api/ai-providers
    /// </summary>
    public class CreateAiProvider : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/ai-providers",
                    async (CreateAiProviderCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        var provider = await mediator.Send(command, ct);
                        return Results.Created($"/api/ai-providers/{provider.Id}", provider);
                    })
                .WithName(nameof(CreateAiProvider))
                .WithTags(AiSettingsConstants.Tag)
                .Produces<AiProviderDto>(StatusCodes.Status201Created)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record CreateAiProviderCommand(string? Template, string? BaseUrl, string? ApiKey, string? Model) : IRequest<AiProviderDto>;

        public class Handler : IRequestHandler<CreateAiProviderCommand, AiProviderDto>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly IAiApiKeyProtector _protector;
            private readonly IAiBaseUrlGuard _urlGuard;

            public Handler(AppDbContext db, ICurrentUserService currentUser, IAiApiKeyProtector protector, IAiBaseUrlGuard urlGuard)
            {
                _db = db;
                _currentUser = currentUser;
                _protector = protector;
                _urlGuard = urlGuard;
            }

            public async ValueTask<AiProviderDto> Handle(CreateAiProviderCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                await _urlGuard.EnsureAllowedAsync(request.BaseUrl!, cancellationToken);

                var apiKey = request.ApiKey!.Trim();
                var provider = AiProviderSetting.Create(
                    userId,
                    request.Template!,
                    request.BaseUrl!,
                    request.Model!,
                    _protector.Protect(apiKey),
                    AiApiKeyMask.Tail(apiKey));

                _db.AiProviderSettings.Add(provider);
                await _db.SaveChangesAsync(cancellationToken);

                return AiProviderDto.From(provider);
            }
        }

        public class Validator : AiProviderFieldsValidator<CreateAiProviderCommand>
        {
            public Validator() : base(x => x.Template, x => x.BaseUrl, x => x.Model)
            {
                ApiKeyFormat(RuleFor(x => x.ApiKey).Cascade(CascadeMode.Stop)
                    .NotEmpty().WithMessage("La clave de API es obligatoria."));
            }
        }
    }
}
