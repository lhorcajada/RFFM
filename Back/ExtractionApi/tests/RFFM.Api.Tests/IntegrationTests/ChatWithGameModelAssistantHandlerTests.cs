#nullable enable
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.AiSettings.Services;
using RFFM.Api.Features.Coaches.GameModels.Assistant;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using RFFM.Api.Features.Coaches.MatchForecast.Services;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class ChatWithGameModelAssistantHandlerTests : IDisposable
    {
        private const string ModelName = "Modelo de prueba";
        private const string QuestionText = "¿Qué quieres revisar?";

        private const string QuestionJson = """{"kind":"question","message":"¿Qué quieres revisar?","changes":[]}""";

        private const string ProposalJson = """
            {
              "kind": "proposal",
              "message": "Propuesta de cambios",
              "changes": [
                { "id": "c1", "operation": "change", "nodeType": "subprincipio", "address": "defensa-organizada-1.1",
                  "fields": { "texto": "Nuevo texto" } },
                { "id": "c2", "operation": "change", "nodeType": "principio", "address": "defensa-organizada-1",
                  "fields": { "texto": "Principio revisado" } },
                { "id": "c3", "operation": "add", "nodeType": "nota", "parentAddress": "defensa-organizada-1",
                  "fields": { "tipo": "nota", "texto": "Nota" } },
                { "id": "c4", "operation": "change", "nodeType": "subprincipio", "address": "no-existe",
                  "fields": { "texto": "x" } },
                { "id": "c5", "operation": "add", "nodeType": "habilidad", "parentAddress": "defensa-organizada-1.1.1",
                  "fields": { "nombre": "Inventado", "descripcion": "d", "entrenable": "s" } }
              ]
            }
            """;

        private readonly PostgresContainerFixture _fixture;
        private readonly FederationDbContext _federation;

        public ChatWithGameModelAssistantHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
            _federation = fixture.CreateFederationDbContext();
        }

        public void Dispose() => _federation.Dispose();

        /// <summary>Scripted provider: a session with no active provider returns NoActiveProvider and records no call.</summary>
        private sealed class ScriptedCompletionService : IAiChatCompletionService
        {
            private readonly Queue<AiChatResult> _replies;

            public ScriptedCompletionService(bool hasActiveProvider, params AiChatResult[] replies)
            {
                HasActiveProvider = hasActiveProvider;
                _replies = new Queue<AiChatResult>(replies);
            }

            public bool HasActiveProvider { get; }

            public List<AiChatRequest> Requests { get; } = new();

            public Task<AiChatResult> CompleteAsync(string userId, AiChatRequest request, CancellationToken cancellationToken)
            {
                if (!HasActiveProvider)
                    return Task.FromResult(AiChatResult.Failed(AiChatFailure.NoActiveProvider));

                Requests.Add(request);
                return Task.FromResult(_replies.Dequeue());
            }

            public Task<AiChatResult> CompleteAsync(AiProviderCredentials credentials, AiChatRequest request, CancellationToken cancellationToken) =>
                throw new NotSupportedException();
        }

        private sealed record Seeded(string UserId, string TeamId, string GameModelId);

        private async Task<Seeded> SeedGameModelAsync(AppDbContext db)
        {
            var club = Club.Create($"Assistant Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Assistant Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, ModelName, "2025-2026");
            var principle = new GamePrinciple(model.Id, 1, "defensa-organizada-1", 1, "Principio original", "Texto original");
            model.Principles.Add(principle);
            var subprincipio = new Subprincipio(principle.Id, "defensa-organizada-1.1", "1.1", "Subprincipio original", "Contexto original");
            principle.Subprincipios.Add(subprincipio);
            var zona = new Zona(subprincipio.Id, "defensa-organizada-1.1-finalizacion", "finalizacion", null, null, "Texto");
            subprincipio.Zonas.Add(zona);
            zona.SubSubPrincipios.Add(new SubSubPrincipio("defensa-organizada-1.1.1", "1.1.1", "Rol", "Texto", null, zona.Id));
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return new Seeded(userId, team.Id, model.Id);
        }

        private static IOptionsMonitor<GameModelAssistantOptions> OptionsFromConfiguration(params (string Key, string Value)[] values)
        {
            var source = values.ToDictionary(v => $"{GameModelAssistantOptions.SectionName}:{v.Key}", v => (string?)v.Value);
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(source).Build();
            var services = new ServiceCollection();
            services.Configure<GameModelAssistantOptions>(configuration.GetSection(GameModelAssistantOptions.SectionName));
            return services.BuildServiceProvider().GetRequiredService<IOptionsMonitor<GameModelAssistantOptions>>();
        }

        private ChatWithGameModelAssistantHandler CreateHandler(AppDbContext db, ScriptedCompletionService ai, IOptionsMonitor<GameModelAssistantOptions> options)
        {
            var contextBuilder = new GameModelAssistantContextBuilder(db, new PlayerConditionService(db),
                new OwnTeamForecastService(db, _federation, Options.Create(new RffmOptions())), options);
            return new ChatWithGameModelAssistantHandler(db, contextBuilder, ai, options);
        }

        private static AssistantMessageDto User(string text) => new("user", text, null);

        private static AssistantMessageDto AssistantQuestion(string text) => new("assistant", text, "question");

        private static ChatWithGameModelAssistantCommand Command(Seeded seeded, params AssistantMessageDto[] messages) =>
            new(seeded.GameModelId, new ChatWithGameModelAssistantRequest(messages)) { UserId = seeded.UserId };

        private static AiChatResult Reply(string json) => AiChatResult.Success(json);

        [Fact]
        public void Command_RequiresReadWritePermissionOnTheGameModelFeature()
        {
            var command = Command(new Seeded("u", "t", "m"), User("Hola"));

            Assert.Equal("ReadWrite", command.RequiredPermission);
            Assert.Equal(CoachFeatureRoutes.GameModel, command.FeatureRoute);
        }

        [Fact]
        public async Task Handle_ForUserWithoutTeamAccess_ThrowsAccessDeniedAndNeverCallsProvider()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply(QuestionJson));
            var stranger = Command(seeded with { UserId = $"stranger-{Guid.NewGuid():N}" }, User("Hola"));

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                CreateHandler(db, ai, OptionsFromConfiguration()).Handle(stranger, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.GameModelAccessDenied, ex.Code);
            Assert.Empty(ai.Requests);
        }

        [Fact]
        public async Task Handle_WithoutActiveProvider_ThrowsConflictWithAiNoActiveProviderAndNoOutboundCall()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: false);

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                CreateHandler(db, ai, OptionsFromConfiguration()).Handle(Command(seeded, User("Hola")), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.AiNoActiveProvider, ex.Code);
            Assert.Equal("No tienes ningún proveedor de IA activo.", ex.Message);
            Assert.Empty(ai.Requests);
        }

        [Fact]
        public async Task Handle_QuestionReply_ReturnsQuestionKindMessageAndNoChanges()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply(QuestionJson));

            var reply = await CreateHandler(db, ai, OptionsFromConfiguration())
                .Handle(Command(seeded, User("Quiero cambiar algo")), CancellationToken.None);

            Assert.Equal("question", reply.Kind);
            Assert.Equal(QuestionText, reply.Message);
            Assert.Empty(reply.Changes);
        }

        [Fact]
        public async Task Handle_AfterMaxClarifyingRounds_AsksProviderToProposeAndStateAssumptions_AndRetriesAQuestion()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply(QuestionJson), Reply(ProposalJson));
            var options = OptionsFromConfiguration(("MaxClarifyingRounds", "2"));

            var reply = await CreateHandler(db, ai, options).Handle(
                Command(seeded, User("Cambia algo"), AssistantQuestion("¿Qué?"), User("Lo que sea"), AssistantQuestion("¿Cuál?"), User("Decide tú")),
                CancellationToken.None);

            Assert.Equal(2, ai.Requests.Count);
            var systemPrompt = ai.Requests[0].Messages[0].Content;
            Assert.Contains("propon", systemPrompt, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("supuest", systemPrompt, StringComparison.OrdinalIgnoreCase);
            Assert.Equal("proposal", reply.Kind);
        }

        [Fact]
        public async Task Handle_InvalidFirstReply_RetriesOnceAndReturnsTheSecondReply()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply("no es json"), Reply(QuestionJson));

            var reply = await CreateHandler(db, ai, OptionsFromConfiguration())
                .Handle(Command(seeded, User("Hola")), CancellationToken.None);

            Assert.Equal(2, ai.Requests.Count);
            Assert.Equal("question", reply.Kind);
            Assert.Equal(QuestionText, reply.Message);
        }

        [Fact]
        public async Task Handle_TwoInvalidReplies_ThrowsInvalidReplyWith502AndLeavesModelUnchanged()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply("no es json"), Reply("{}"));

            var ex = await Assert.ThrowsAsync<GameModelAssistantFailureException>(() =>
                CreateHandler(db, ai, OptionsFromConfiguration()).Handle(Command(seeded, User("Hola")), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.GameModelAssistantInvalidReply, ex.Code);
            Assert.Equal(502, ex.StatusCode);
            Assert.Equal(2, ai.Requests.Count);
            var stored = await db.GameModels.AsNoTracking().SingleAsync(gm => gm.Id == seeded.GameModelId);
            Assert.Equal(ModelName, stored.Name);
        }

        [Fact]
        public async Task Handle_ProposalWithTwoInvalidChanges_ReturnsThreeChangesDiscardedTwoAndStoredVersion()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply(ProposalJson));

            var reply = await CreateHandler(db, ai, OptionsFromConfiguration())
                .Handle(Command(seeded, User("Propón cambios")), CancellationToken.None);

            Assert.Equal("proposal", reply.Kind);
            Assert.Equal(3, reply.Changes.Count);
            Assert.Equal(2, reply.DiscardedCount);
            var stored = await db.GameModels.AsNoTracking().SingleAsync(gm => gm.Id == seeded.GameModelId);
            Assert.Equal(stored.Version.ToString("D"), reply.Version);
        }

        [Fact]
        public async Task Handle_ProviderQuotaExceeded_ThrowsFailureWith429AndTheQuotaMessage()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, AiChatResult.Failed(AiChatFailure.QuotaExceeded));

            var ex = await Assert.ThrowsAsync<GameModelAssistantFailureException>(() =>
                CreateHandler(db, ai, OptionsFromConfiguration()).Handle(Command(seeded, User("Hola")), CancellationToken.None).AsTask());

            Assert.Equal(429, ex.StatusCode);
            Assert.Equal(AiChatFailureMessages.For(AiChatFailure.QuotaExceeded), ex.Message);
            Assert.Single(ai.Requests);
        }

        [Fact]
        public async Task Handle_AnyCall_LeavesTheTrackedModelUnchanged()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedGameModelAsync(db);
            var ai = new ScriptedCompletionService(hasActiveProvider: true, Reply(QuestionJson));

            var reply = await CreateHandler(db, ai, OptionsFromConfiguration())
                .Handle(Command(seeded, User("Hola")), CancellationToken.None);

            Assert.Equal(QuestionText, reply.Message);
            Assert.False(db.ChangeTracker.HasChanges());
        }

        [Fact]
        public void Validator_RejectsConversationWhoseLastMessageIsNotFromTheUser()
        {
            var validator = new ChatWithGameModelAssistantValidator(OptionsFromConfiguration());
            var command = Command(new Seeded("u", "t", "m"), User("Hola"), AssistantQuestion("¿Qué?"));

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_RejectsMoreMessagesThanMaxMessages()
        {
            var validator = new ChatWithGameModelAssistantValidator(OptionsFromConfiguration(("MaxMessages", "2")));
            var command = Command(new Seeded("u", "t", "m"), User("Uno"), User("Dos"), User("Tres"));

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_AcceptsConversationWithinLimitsEndingWithUserMessage()
        {
            var validator = new ChatWithGameModelAssistantValidator(OptionsFromConfiguration(("MaxMessages", "2")));
            var command = Command(new Seeded("u", "t", "m"), AssistantQuestion("¿Qué?"), User("Cambia el texto"));

            var result = validator.Validate(command);

            Assert.True(result.IsValid);
        }
    }
}
