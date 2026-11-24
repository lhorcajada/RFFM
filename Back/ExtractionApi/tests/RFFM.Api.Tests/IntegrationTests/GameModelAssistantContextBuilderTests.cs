#nullable enable
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Assistant;
using RFFM.Api.Features.Coaches.MatchForecast.Services;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class GameModelAssistantContextBuilderTests
    {
        private const string Dni = "12345678Z";
        private const string Phone = "600111222";
        private const string Email = "jugador@example.com";
        private const string FullName = "Juan Perez Lopez";
        private const string InjuryDescription = "lesion causada por Pedro Gomez";
        private const string InjuryType = "Esguince de tobillo";
        private const string EstimatedRecovery = "tres semanas";
        private const string SessionObjective = "Presión tras pérdida";
        private const string SeasonNoteText = "Objetivo: ganar la liga con presión alta";

        private readonly PostgresContainerFixture _fixture;

        public GameModelAssistantContextBuilderTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record Seeded(string TeamId, string ClubId, string SeasonId);

        private async Task<Seeded> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"AssistantContext Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "AssistantContext Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return new Seeded(team.Id, club.Id, season.Id);
        }

        private static async Task<string> SeedPersonalPlayerAsync(AppDbContext db, Seeded seeded, string alias)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Juan",
                LastName = "Perez Lopez",
                Alias = alias,
                ClubId = seeded.ClubId,
                Dni = Dni
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = seeded.TeamId,
                SeasonId = seeded.SeasonId,
                JoinedDate = DateTime.UtcNow.AddDays(-60),
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>(),
                ContactInfo = new ContactModel { Phone = Phone, Email = Email }
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private static async Task SeedInjuryAsync(AppDbContext db, string teamPlayerId, DateTime start, DateTime end)
        {
            var injury = TeamPlayerInjury.Create(teamPlayerId, start, InjuryType, InjuryDescription, EstimatedRecovery);
            injury.Update(start, InjuryType, InjuryDescription, EstimatedRecovery, end);
            db.TeamPlayerInjuries.Add(injury);
            await db.SaveChangesAsync();
        }

        private static async Task SeedSessionAsync(AppDbContext db, string teamId, DateTime date)
        {
            db.TrainingSessions.Add(new TrainingSession
            {
                Name = "Sesión de presión",
                TeamId = teamId,
                Date = date,
                ObjetivoGeneral = SessionObjective
            });
            await db.SaveChangesAsync();
        }

        /// <summary>Principio → Subprincipio → Zona → SubSubPrincipio, plus a season objective note on the principle.</summary>
        private static GameModel BuildModel(string teamId)
        {
            var model = new GameModel(teamId, "Modelo de prueba", "2025-2026");
            var principle = new GamePrinciple(model.Id, 1, "defensa-organizada-1", 1, "Principio", "Texto");
            model.Principles.Add(principle);
            var subprincipio = new Subprincipio(principle.Id, "defensa-organizada-1.1", "1.1", "Subprincipio", "Texto");
            principle.Subprincipios.Add(subprincipio);
            var zona = new Zona(subprincipio.Id, "defensa-organizada-1.1-finalizacion", "finalizacion", null, null, "Texto");
            subprincipio.Zonas.Add(zona);
            zona.SubSubPrincipios.Add(new SubSubPrincipio("defensa-organizada-1.1.1", "1.1.1", "Rol", "Texto", null, zona.Id));
            model.Notas.Add(new Nota(model.Id, "objetivo-temporada", SeasonNoteText, principle.Id, null, null, null));
            return model;
        }

        private static GameModelAssistantContextBuilder CreateBuilder(AppDbContext appDb, FederationDbContext fedDb,
            IOptionsMonitor<GameModelAssistantOptions> options) =>
            new(appDb, new PlayerConditionService(appDb),
                new OwnTeamForecastService(appDb, fedDb, Options.Create(new RffmOptions())), options);

        private static (IOptionsMonitor<GameModelAssistantOptions> Monitor, ConfigurationRoot Root) OptionsFromConfiguration(
            params (string Key, string Value)[] values)
        {
            var source = values.ToDictionary(v => $"{GameModelAssistantOptions.SectionName}:{v.Key}", v => (string?)v.Value);
            var root = (ConfigurationRoot)new ConfigurationBuilder().AddInMemoryCollection(source).Build();
            var services = new ServiceCollection();
            services.Configure<GameModelAssistantOptions>(root.GetSection(GameModelAssistantOptions.SectionName));
            return (services.BuildServiceProvider().GetRequiredService<IOptionsMonitor<GameModelAssistantOptions>>(), root);
        }

        [Fact]
        public async Task BuildAsync_TextContainsNoIdentifyingFieldsNorInjuryDescription()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var alias = $"Alias-{Guid.NewGuid():N}";
            var teamPlayerId = await SeedPersonalPlayerAsync(appDb, seeded, alias);
            await SeedInjuryAsync(appDb, teamPlayerId, DateTime.UtcNow.Date.AddDays(-20), DateTime.UtcNow.Date.AddDays(-5));
            var (monitor, _) = OptionsFromConfiguration();
            var model = BuildModel(seeded.TeamId);

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(model, seeded.TeamId, CancellationToken.None);

            Assert.Contains(alias, context.Text);
            Assert.DoesNotContain(Dni, context.Text);
            Assert.DoesNotContain(Phone, context.Text);
            Assert.DoesNotContain(Email, context.Text);
            Assert.DoesNotContain(FullName, context.Text);
            Assert.DoesNotContain(InjuryDescription, context.Text);
        }

        [Fact]
        public async Task BuildAsync_InjuryAppearsWithTypeDatesAndEstimatedRecovery()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var teamPlayerId = await SeedPersonalPlayerAsync(appDb, seeded, $"Alias-{Guid.NewGuid():N}");
            var start = DateTime.UtcNow.Date.AddDays(-20);
            var end = DateTime.UtcNow.Date.AddDays(-5);
            await SeedInjuryAsync(appDb, teamPlayerId, start, end);
            var (monitor, _) = OptionsFromConfiguration();

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(BuildModel(seeded.TeamId), seeded.TeamId, CancellationToken.None);

            Assert.Contains(InjuryType, context.Text);
            Assert.Contains(start.ToString("yyyy-MM-dd"), context.Text);
            Assert.Contains(end.ToString("yyyy-MM-dd"), context.Text);
            Assert.Contains(EstimatedRecovery, context.Text);
        }

        [Fact]
        public async Task BuildAsync_ListsEachPlayerByAliasWithFatigue()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var alias = $"Alias-{Guid.NewGuid():N}";
            await SeedPersonalPlayerAsync(appDb, seeded, alias);
            var (monitor, _) = OptionsFromConfiguration();

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(BuildModel(seeded.TeamId), seeded.TeamId, CancellationToken.None);

            Assert.Contains(alias, context.Text);
            Assert.Contains("Cansancio", context.Text);
        }

        [Fact]
        public async Task BuildAsync_ListsModelNodesWithAddressesAndTheObjectives()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            await SeedSessionAsync(appDb, seeded.TeamId, DateTime.UtcNow.Date);
            var (monitor, _) = OptionsFromConfiguration();

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(BuildModel(seeded.TeamId), seeded.TeamId, CancellationToken.None);

            Assert.Contains("defensa-organizada-1", context.Text);
            Assert.Contains("defensa-organizada-1.1", context.Text);
            Assert.Contains("defensa-organizada-1.1-finalizacion", context.Text);
            Assert.Contains("defensa-organizada-1.1.1", context.Text);
            Assert.Contains(SeasonNoteText, context.Text);
            Assert.Contains(SessionObjective, context.Text);
        }

        [Fact]
        public void AssistantPlayerContextAndInjuryContext_HaveExactlyTheAllowlistedMembers()
        {
            var playerMembers = typeof(AssistantPlayerContext)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Select(p => p.Name)
                .OrderBy(n => n, StringComparer.Ordinal)
                .ToList();
            var injuryMembers = typeof(AssistantInjuryContext)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Select(p => p.Name)
                .OrderBy(n => n, StringComparer.Ordinal)
                .ToList();

            Assert.Equal(new List<string> { "Alias", "FormStatus", "Fatigue", "Injuries", "Readiness" }.OrderBy(n => n, StringComparer.Ordinal), playerMembers);
            Assert.Equal(new List<string> { "EndDate", "EstimatedRecovery", "InjuryType", "StartDate" }, injuryMembers);
        }

        [Fact]
        public async Task BuildAsync_ThrowsContextTooLarge_WhenTextExceedsMaxContextCharacters()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            await SeedSessionAsync(appDb, seeded.TeamId, DateTime.UtcNow.Date);
            var (monitor, _) = OptionsFromConfiguration(("MaxContextCharacters", "100"));

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                CreateBuilder(appDb, fedDb, monitor).BuildAsync(BuildModel(seeded.TeamId), seeded.TeamId, CancellationToken.None));

            Assert.Equal(ErrorCodes.GameModelAssistantContextTooLarge, ex.Code);
        }

        [Fact]
        public async Task BuildAsync_ModelVersionEqualsTheStoredModelMarker()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration();
            var model = BuildModel(seeded.TeamId);

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(model, seeded.TeamId, CancellationToken.None);

            Assert.NotEqual(Guid.Empty, context.ModelVersion);
            Assert.Equal(model.Version, context.ModelVersion);
        }

        [Fact]
        public void MaxClarifyingRounds_ChangedInConfiguration_IsVisibleThroughOptionsMonitorWithoutRecompiling()
        {
            var (monitor, root) = OptionsFromConfiguration(("MaxClarifyingRounds", "2"));
            Assert.Equal(2, monitor.CurrentValue.MaxClarifyingRounds);

            root[$"{GameModelAssistantOptions.SectionName}:MaxClarifyingRounds"] = "5";
            root.Reload();

            Assert.Equal(5, monitor.CurrentValue.MaxClarifyingRounds);
        }

        [Fact]
        public async Task BuildAsync_MaxContextCharactersChangedInConfiguration_TakesEffectWithoutRestart()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            await SeedSessionAsync(appDb, seeded.TeamId, DateTime.UtcNow.Date);
            var (monitor, root) = OptionsFromConfiguration(("MaxContextCharacters", "100"));
            var builder = CreateBuilder(appDb, fedDb, monitor);
            var model = BuildModel(seeded.TeamId);
            await Assert.ThrowsAsync<DomainException>(() => builder.BuildAsync(model, seeded.TeamId, CancellationToken.None));

            root[$"{GameModelAssistantOptions.SectionName}:MaxContextCharacters"] = "1000000";
            root.Reload();
            var context = await builder.BuildAsync(model, seeded.TeamId, CancellationToken.None);

            Assert.Contains(SeasonNoteText, context.Text);
        }

        private const string RecoverMarker = "MARCADOR-RECUPERAR";
        private const string BuildUpMarker = "MARCADOR-SALIDA";

        /// <summary>Two principles ("Recuperar balon" and "Salida de balon"), each with one subprincipio holding a marker plus padding.</summary>
        private static GameModel BuildTwoBranchModel(string teamId, int padding)
        {
            var filler = new string('x', padding);
            var model = new GameModel(teamId, "Modelo de prueba", "2025-2026");

            var recover = new GamePrinciple(model.Id, 1, "recuperar-balon-1", 1, "Recuperar balon", "Texto");
            model.Principles.Add(recover);
            recover.Subprincipios.Add(new Subprincipio(recover.Id, "recuperar-balon-1.1", "1.1", "Presion", $"{RecoverMarker} {filler}"));

            var buildUp = new GamePrinciple(model.Id, 2, "salida-balon-2", 2, "Salida de balon", "Texto");
            model.Principles.Add(buildUp);
            buildUp.Subprincipios.Add(new Subprincipio(buildUp.Id, "salida-balon-2.1", "2.1", "Progresion", $"{BuildUpMarker} {filler}"));

            return model;
        }

        [Fact]
        public async Task BuildAsync_FocusNamesOneBranch_SendsItsFullTextAndOnlyTheTitlesOfTheOthers()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration(("FullDetailCharacters", "0"));

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(
                BuildTwoBranchModel(seeded.TeamId, 50), seeded.TeamId, CancellationToken.None,
                new[] { "Modifica el principio de Recuperar balón" });

            Assert.Contains(RecoverMarker, context.Text);
            Assert.DoesNotContain(BuildUpMarker, context.Text);
            Assert.Contains("salida-balon-2", context.Text);
            Assert.Contains("Salida de balon", context.Text);
        }

        [Fact]
        public async Task BuildAsync_FocusMatchesNoBranch_SendsOnlyTitlesAndAsksForTheBranch()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration(("FullDetailCharacters", "0"));

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(
                BuildTwoBranchModel(seeded.TeamId, 50), seeded.TeamId, CancellationToken.None,
                new[] { "Hazlo mas claro" });

            Assert.DoesNotContain(RecoverMarker, context.Text);
            Assert.DoesNotContain(BuildUpMarker, context.Text);
            Assert.Contains("recuperar-balon-1", context.Text);
            Assert.Contains("salida-balon-2", context.Text);
            Assert.Contains("ninguna rama concreta", context.Text);
        }

        [Fact]
        public async Task BuildAsync_LastMessageMatchesNothing_FallsBackToTheNextFocusText()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration(("FullDetailCharacters", "0"));

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(
                BuildTwoBranchModel(seeded.TeamId, 50), seeded.TeamId, CancellationToken.None,
                new[] { "Si, hazlo", "Revisa la Salida de balon\nSi, hazlo" });

            Assert.Contains(BuildUpMarker, context.Text);
            Assert.DoesNotContain(RecoverMarker, context.Text);
        }

        [Fact]
        public async Task BuildAsync_ModelFitsInFullDetailLimit_SendsEveryBranchInFull()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration(("FullDetailCharacters", "100000"));

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(
                BuildTwoBranchModel(seeded.TeamId, 50), seeded.TeamId, CancellationToken.None,
                new[] { "Modifica el principio de Recuperar balón" });

            Assert.Contains(RecoverMarker, context.Text);
            Assert.Contains(BuildUpMarker, context.Text);
        }

        [Fact]
        public async Task BuildAsync_FullModelExceedsLimitButFocusedBranchFits_DoesNotThrow()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration(("FullDetailCharacters", "0"), ("MaxContextCharacters", "8000"));
            var model = BuildTwoBranchModel(seeded.TeamId, 5000);

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(
                model, seeded.TeamId, CancellationToken.None, new[] { "Cambia Recuperar balon" });

            Assert.Contains(RecoverMarker, context.Text);
            Assert.True(context.Text.Length <= 8000);
        }

        [Fact]
        public async Task BuildAsync_FocusedBranchStillExceedsLimit_ThrowsContextTooLarge()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var (monitor, _) = OptionsFromConfiguration(("FullDetailCharacters", "0"), ("MaxContextCharacters", "3000"));

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                CreateBuilder(appDb, fedDb, monitor).BuildAsync(
                    BuildTwoBranchModel(seeded.TeamId, 5000), seeded.TeamId, CancellationToken.None, new[] { "Cambia Recuperar balon" }));

            Assert.Equal(ErrorCodes.GameModelAssistantContextTooLarge, ex.Code);
        }

        private static async Task SeedInjuryOfTypeAsync(AppDbContext db, string teamPlayerId, string injuryType, DateTime start, DateTime? end)
        {
            var injury = TeamPlayerInjury.Create(teamPlayerId, start, injuryType, InjuryDescription, EstimatedRecovery);
            if (end is { } endDate)
                injury.Update(start, injuryType, InjuryDescription, EstimatedRecovery, endDate);
            db.TeamPlayerInjuries.Add(injury);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task BuildAsync_L1_FirstNameAndLastNameAreAbsentEachOnItsOwnAndTheAliasIsPresent()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var alias = $"Alias-{Guid.NewGuid():N}";
            await SeedPersonalPlayerAsync(appDb, seeded, alias);
            var (monitor, _) = OptionsFromConfiguration();

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(BuildModel(seeded.TeamId), seeded.TeamId, CancellationToken.None);

            Assert.Contains(alias, context.Text);
            Assert.DoesNotContain("Juan", context.Text);
            Assert.DoesNotContain("Perez", context.Text);
            Assert.DoesNotContain("Lopez", context.Text);
        }

        [Fact]
        public async Task BuildAsync_L2_InjuryEndedBeforeTheWindowIsLeftOut_OpenAndRecentInjuriesAreIncluded()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var teamPlayerId = await SeedPersonalPlayerAsync(appDb, seeded, $"Alias-{Guid.NewGuid():N}");
            var today = DateTime.UtcNow.Date;
            await SeedInjuryOfTypeAsync(appDb, teamPlayerId, "Lesion antigua", today.AddDays(-200), today.AddDays(-150));
            await SeedInjuryOfTypeAsync(appDb, teamPlayerId, "Lesion reciente", today.AddDays(-40), today.AddDays(-5));
            await SeedInjuryOfTypeAsync(appDb, teamPlayerId, "Lesion abierta", today.AddDays(-10), null);
            var (monitor, _) = OptionsFromConfiguration();

            var context = await CreateBuilder(appDb, fedDb, monitor).BuildAsync(BuildModel(seeded.TeamId), seeded.TeamId, CancellationToken.None);

            Assert.DoesNotContain("Lesion antigua", context.Text);
            Assert.Contains("Lesion reciente", context.Text);
            Assert.Contains("Lesion abierta", context.Text);
        }

        [Fact]
        public async Task BuildAsync_L3_PlayersWithoutAliasAreNumberedInTeamPlayerIdOrder()
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var fedDb = _fixture.CreateFederationDbContext();
            var seeded = await SeedTeamAsync(appDb);
            var players = new List<(string TeamPlayerId, string Injury)>();
            foreach (var injury in new[] { "Lesion jugador A", "Lesion jugador B", "Lesion jugador C" })
            {
                var alias = $"Alias-{Guid.NewGuid():N}";
                var teamPlayerId = await SeedPersonalPlayerAsync(appDb, seeded, alias);
                // Blank aliases still differ from each other (the alias index is unique); the builder trims them to empty.
                var blankAlias = new string(' ', players.Count + 1);
                await appDb.Players.Where(p => p.Alias == alias).ExecuteUpdateAsync(s => s.SetProperty(p => p.Alias, blankAlias));
                await SeedInjuryOfTypeAsync(appDb, teamPlayerId, injury, DateTime.UtcNow.Date.AddDays(-10), null);
                players.Add((teamPlayerId, injury));
            }
            var (monitor, _) = OptionsFromConfiguration();
            var builder = CreateBuilder(appDb, fedDb, monitor);
            var model = BuildModel(seeded.TeamId);

            var first = await builder.BuildAsync(model, seeded.TeamId, CancellationToken.None);
            var second = await builder.BuildAsync(model, seeded.TeamId, CancellationToken.None);

            var idOrder = players.OrderBy(p => p.TeamPlayerId, StringComparer.Ordinal).ToList();
            var lines = first.Text.Split('\n').Select(l => l.TrimEnd('\r')).ToList();
            var jugador1 = lines.FindIndex(l => l.StartsWith("- Jugador 1:", StringComparison.Ordinal));
            var jugador2 = lines.FindIndex(l => l.StartsWith("- Jugador 2:", StringComparison.Ordinal));
            Assert.True(jugador1 >= 0 && jugador2 >= 0);
            Assert.Contains(idOrder[0].Injury, lines[jugador1 + 1]);
            Assert.Contains(idOrder[1].Injury, lines[jugador2 + 1]);
            Assert.Equal(first.Text, second.Text);
        }
    }
}
