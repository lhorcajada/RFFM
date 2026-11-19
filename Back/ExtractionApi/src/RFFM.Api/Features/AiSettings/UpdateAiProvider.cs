using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.AiSettings.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.AiSettings
{
    /// <summary>
    /// Edits an AI provider of the current user. Without a new API key the stored key is kept.
    /// PUT /api/ai-providers/{id}
    /// </summary>
    public class UpdateAiProvider : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/ai-providers/{id}",
                    async (string id, UpdateAiProviderCommand command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(command with { Id = id }, ct)))
                .WithName(nameof(UpdateAiProvider))
                .WithTags(AiSettingsConstants.Tag)
                .Produces<AiProviderDto>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record UpdateAiProviderCommand(string? Template, string? BaseUrl, string? ApiKey, string? Model) : IRequest<AiProviderDto>
        {
            public string Id { get; init; } = string.Empty;
        }

        public class Handler : IRequestHandler<UpdateAiProviderCommand, AiProviderDto>
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

            public async ValueTask<AiProviderDto> Handle(UpdateAiProviderCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var provider = await _db.AiProviderSettings
                    .FirstOrDefaultAsync(p => p.Id == request.Id && p.UserId == userId, cancellationToken)
                    ?? throw new NotFoundException("No se encontró el proveedor de IA.", ErrorCodes.AiProviderNotFound);

                await _urlGuard.EnsureAllowedAsync(request.BaseUrl!, cancellationToken);

                provider.Update(request.Template!, request.BaseUrl!, request.Model!);

                if (!string.IsNullOrWhiteSpace(request.ApiKey))
                {
                    var apiKey = request.ApiKey.Trim();
                    provider.ReplaceApiKey(_protector.Protect(apiKey), AiApiKeyMask.Tail(apiKey));
                }

                await _db.SaveChangesAsync(cancellationToken);

                return AiProviderDto.From(provider);
            }
        }

        public class Validator : AiProviderFieldsValidator<UpdateAiProviderCommand>
        {
            public Validator() : base(x => x.Template, x => x.BaseUrl, x => x.Model)
            {
                ApiKeyFormat(RuleFor(x => x.ApiKey));
            }
        }
    }
}
