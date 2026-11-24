#nullable enable
using System.Text;
using System.Text.Json;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.AiSettings.Services;
using RFFM.Api.Features.Coaches.GameModels.Assistant;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// POST /api/game-models/{gameModelId}/assistant — one turn of the game-model assistant. The
    /// browser sends the whole conversation; nothing is stored. Returns a clarifying question or
    /// a validated proposal (cards are accepted one by one in the browser).
    /// </summary>
    public class ChatWithGameModelAssistant : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/game-models/{gameModelId}/assistant",
                    async (string gameModelId, ChatWithGameModelAssistantRequest request, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var reply = await mediator.Send(
                            new ChatWithGameModelAssistantCommand(gameModelId, request) { UserId = userId }, cancellationToken);
                        return Results.Ok(reply);
                    })
                .WithName(nameof(ChatWithGameModelAssistant))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<AssistantReplyDto>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .Produces<ProblemDetails>(StatusCodes.Status429TooManyRequests)
                .Produces<ProblemDetails>(StatusCodes.Status502BadGateway);
        }
    }

    // ── Request and response ──────────────────────────────────────────────────────────────────────

    public record AssistantMessageDto(string Role, string Content, string? Kind);

    public record ChatWithGameModelAssistantRequest(IReadOnlyList<AssistantMessageDto> Messages);

    public record AssistantChangeDto(
        string Id,
        string Operation,
        string NodeType,
        string? Address,
        string? ParentAddress,
        string? ParentChangeId,
        IReadOnlyDictionary<string, JsonElement> Fields);

    public record AssistantReplyDto(string Kind, string Message, IReadOnlyList<AssistantChangeDto> Changes, int DiscardedCount, string Version);

    public record ChatWithGameModelAssistantCommand(string GameModelId, ChatWithGameModelAssistantRequest Request)
        : RFFM.Api.Common.ICommand<AssistantReplyDto>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    /// <summary>A provider reply that could not be used, or a provider failure, with its HTTP status.</summary>
    public sealed class GameModelAssistantFailureException(string code, int statusCode, string message) : Exception(message)
    {
        public string Code { get; } = code;
        public int StatusCode { get; } = statusCode;
    }

    // ── Handler ───────────────────────────────────────────────────────────────────────

    public class ChatWithGameModelAssistantHandler(
        AppDbContext db,
        GameModelAssistantContextBuilder contextBuilder,
        IAiChatCompletionService ai,
        IOptionsMonitor<GameModelAssistantOptions> options)
        : IRequestHandler<ChatWithGameModelAssistantCommand, AssistantReplyDto>
    {
        private const string QuestionKind = "question";
        private const string ProposalKind = "proposal";
        private const int MaxAttempts = 2;
        private const string InvalidReplyMessage = "El asistente no devolvió una propuesta válida. Inténtalo de nuevo.";

        public async ValueTask<AssistantReplyDto> Handle(ChatWithGameModelAssistantCommand request, CancellationToken cancellationToken = default)
        {
            var model = await LoadModelAsync(request.GameModelId, cancellationToken);
            if (model is null)
                throw new DomainException("Modelo de Juego", "Modelo de juego no encontrado.", ErrorCodes.GameModelNotFound);

            var hasAccess = await db.UserClubs
                .Join(db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == model.TeamId, cancellationToken);
            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

            var settings = options.CurrentValue;
            var conversation = request.Request.Messages;
            var context = await contextBuilder.BuildAsync(model, model.TeamId, cancellationToken, FocusTexts(conversation));

            var askedRounds = conversation.Count(m => m.Role == AiChatRoles.Assistant && m.Kind == QuestionKind);
            var maxRoundsReached = askedRounds >= settings.MaxClarifyingRounds;

            var aiRequest = new AiChatRequest(
                BuildMessages(context.Text, conversation, askedRounds, maxRoundsReached),
                settings.MaxOutputTokens,
                GameModelAssistantEnvelope.JsonSchema);

            // Provider calls are capped at MaxAttempts: a reply that breaks the schema, or a question once the
            // clarifying rounds are used up, gets one retry; a second failure is reported as an invalid reply.
            for (var attempt = 0; attempt < MaxAttempts; attempt++)
            {
                var result = await ai.CompleteAsync(request.UserId, aiRequest, cancellationToken);
                if (!result.Succeeded)
                    throw ProviderFailure(result.Failure!.Value);

                if (!GameModelAssistantEnvelope.TryParse(result.Content!, out var envelope, out _) || envelope is null)
                    continue;

                if (envelope.Kind == AssistantReplyKind.Question && maxRoundsReached)
                    continue;

                var proposal = GameModelProposalValidator.Validate(model, envelope);
                return ToReply(envelope, proposal, context.ModelVersion);
            }

            throw new GameModelAssistantFailureException(
                ErrorCodes.GameModelAssistantInvalidReply, StatusCodes.Status502BadGateway, InvalidReplyMessage);
        }

        private async Task<GameModel?> LoadModelAsync(string gameModelId, CancellationToken cancellationToken) =>
            await db.GameModels
                .Include(gm => gm.Principles)
                    .ThenInclude(p => p.Subprincipios)
                        .ThenInclude(sp => sp.Zonas)
                            .ThenInclude(z => z.SubSubPrincipios)
                                .ThenInclude(ssp => ssp.Habilidades)
                .Include(gm => gm.Principles)
                    .ThenInclude(p => p.Subprincipios)
                        .ThenInclude(sp => sp.SubSubPrincipios)
                            .ThenInclude(ssp => ssp.Habilidades)
                .Include(gm => gm.Notas)
                .Include(gm => gm.SetPieceRules)
                .AsSplitQuery()
                .AsNoTracking()
                .FirstOrDefaultAsync(gm => gm.Id == gameModelId, cancellationToken);

        /// <summary>The last message first, then the whole conversation: the branches the coach is talking about right now win.</summary>
        private static IReadOnlyList<string> FocusTexts(IReadOnlyList<AssistantMessageDto> conversation) =>
            conversation.Count == 0
                ? Array.Empty<string>()
                : new[] { conversation[^1].Content, string.Join("\n", conversation.Select(m => m.Content)) };

        private static Exception ProviderFailure(AiChatFailure failure) => failure switch
        {
            AiChatFailure.NoActiveProvider => new ConflictException(AiChatFailureMessages.For(failure), ErrorCodes.AiNoActiveProvider),
            AiChatFailure.QuotaExceeded => new GameModelAssistantFailureException(
                ErrorCodes.AiProviderQuotaExceeded, StatusCodes.Status429TooManyRequests, AiChatFailureMessages.For(failure)),
            _ => new GameModelAssistantFailureException(
                ErrorCodes.AiProviderFailed, StatusCodes.Status502BadGateway, AiChatFailureMessages.For(failure))
        };

        private static List<AiChatMessage> BuildMessages(string contextText, IReadOnlyList<AssistantMessageDto> conversation,
            int askedRounds, bool maxRoundsReached)
        {
            var messages = new List<AiChatMessage> { new(AiChatRoles.System, SystemPrompt(contextText, askedRounds, maxRoundsReached)) };
            messages.AddRange(conversation.Select(m => new AiChatMessage(m.Role, m.Content)));
            return messages;
        }

        private static string SystemPrompt(string contextText, int askedRounds, bool maxRoundsReached)
        {
            var prompt = new StringBuilder();
            prompt.AppendLine("Eres el asistente del modelo de juego de un equipo de fútbol. Ayudas al entrenador a revisar y modificar el modelo.");
            prompt.AppendLine("Responde únicamente con un objeto JSON que cumpla exactamente este esquema:");
            prompt.AppendLine(GameModelAssistantEnvelope.JsonSchema);
            prompt.AppendLine();
            prompt.AppendLine("Reglas:");
            prompt.AppendLine($"- kind \"{QuestionKind}\" solo para pedir una aclaración; en ese caso changes va vacío.");
            prompt.AppendLine($"- kind \"{ProposalKind}\" para proponer cambios. Cada change apunta a una address del modelo, o es un add bajo " +
                              "un parentAddress existente o un parentChangeId de un add anterior de la misma propuesta.");
            prompt.AppendLine("- Nombres de habilidad permitidos: " + Ordered(Habilidad.Vocabulary) + ".");
            prompt.AppendLine("- Tipos de nota permitidos: " + Ordered(Nota.Tipos) + ".");
            prompt.AppendLine("- Subtipos de balón parado permitidos: " + Ordered(SetPieceRule.Subtypes) + ".");
            prompt.AppendLine("- Claves de zona permitidas: " + Ordered(Zona.KnownZoneKeys) + ".");
            prompt.AppendLine("- Del modelo puede llegar solo el título de algunas ramas: no propongas cambios sobre nodos cuyo detalle no veas; pide al entrenador que indique la rama.");
            prompt.AppendLine("- No inventes datos de jugadores ni menciones datos personales.");
            if (maxRoundsReached)
            {
                prompt.AppendLine($"Ya has hecho {askedRounds.ToString(System.Globalization.CultureInfo.InvariantCulture)} preguntas de aclaración: " +
                                  "no hagas más preguntas. Debes proponer ahora cambios concretos (kind \"proposal\") y declarar " +
                                  "en el message los supuestos que hayas usado.");
            }
            prompt.AppendLine();
            prompt.AppendLine("Contexto del modelo:");
            prompt.Append(contextText);
            return prompt.ToString();
        }

        private static string Ordered(IEnumerable<string> values) => string.Join(", ", values.OrderBy(v => v, StringComparer.Ordinal));

        private static AssistantReplyDto ToReply(AssistantEnvelope envelope, ValidatedProposal proposal, Guid modelVersion) =>
            new(envelope.Kind == AssistantReplyKind.Question ? QuestionKind : ProposalKind,
                envelope.Message,
                proposal.Changes.Select(ToChangeDto).ToList(),
                proposal.DiscardedCount,
                modelVersion.ToString("D"));

        private static AssistantChangeDto ToChangeDto(AssistantChange change) => new(
            change.Id,
            change.Operation switch
            {
                AssistantOperation.Add => "add",
                AssistantOperation.Change => "change",
                _ => "remove"
            },
            change.NodeType switch
            {
                AssistantNodeType.Principio => "principio",
                AssistantNodeType.Subprincipio => "subprincipio",
                AssistantNodeType.Zona => "zona",
                AssistantNodeType.SubSubPrincipio => "subSubPrincipio",
                AssistantNodeType.Habilidad => "habilidad",
                AssistantNodeType.Nota => "nota",
                _ => "setPieceRule"
            },
            change.Address,
            change.ParentAddress,
            change.ParentChangeId,
            change.Fields);
    }

    // ── Validator ──────────────────────────────────────────────────────────────────────

    public class ChatWithGameModelAssistantValidator : AbstractValidator<ChatWithGameModelAssistantCommand>
    {
        public ChatWithGameModelAssistantValidator(IOptionsMonitor<GameModelAssistantOptions> options)
        {
            RuleFor(x => x.GameModelId).NotEmpty();
            RuleFor(x => x.Request).NotNull();

            When(x => x.Request is not null, () =>
            {
                RuleFor(x => x.Request.Messages)
                    .NotNull()
                    .Must(messages => messages is not null && messages.Count > 0)
                    .WithMessage("La conversación no puede estar vacía.")
                    .Must(messages => messages is null || messages.Count <= options.CurrentValue.MaxMessages)
                    .WithMessage("La conversación tiene más mensajes de los permitidos.")
                    .Must(messages => messages is null || messages.Count == 0 || messages[^1].Role == AiChatRoles.User)
                    .WithMessage("El último mensaje de la conversación debe ser del usuario.");

                RuleForEach(x => x.Request.Messages)
                    .Must(message => message is not null && (message.Role == AiChatRoles.User || message.Role == AiChatRoles.Assistant))
                    .WithMessage("El rol de un mensaje no es válido.");

                RuleForEach(x => x.Request.Messages)
                    .Must(message => message is not null
                                     && !string.IsNullOrWhiteSpace(message.Content)
                                     && message.Content.Length <= options.CurrentValue.MaxMessageLength)
                    .WithMessage("Un mensaje está vacío o supera la longitud máxima permitida.");
            });
        }
    }
}
