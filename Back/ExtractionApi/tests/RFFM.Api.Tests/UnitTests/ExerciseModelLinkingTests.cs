#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Persistence.Seed;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers the direct Exercise-GameModel link (design.md Amendment 2): ModelLinks + Habilidades
    /// on CreateExercise/UpdateExercise.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ExerciseModelLinkingTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExerciseModelLinkingTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId)> SeedClubAsync(AppDbContext db)
        {
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"ExerciseModelLinking Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id);
        }

        private static async Task<(string SubprincipioId, string SubSubPrincipioId)> SeedAdnNodesAsync(AppDbContext db, string clubId)
        {
            var model = new GameModel(clubId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"subsub-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subprincipio.Id, null);

            principle.Subprincipios.Add(subprincipio);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            model.Principles.Add(principle);

            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (subprincipio.Id, subSubPrincipio.Id);
        }

        private static CreateExerciseCommand BaseCommand(
            string clubId, string userId,
            List<ExerciseModelLinkRequest>? modelLinks = null, List<string>? habilidades = null) => new(
            clubId, "Ejercicio vinculado al modelo", "Descripción", new List<string> { "Physical" },
            10, 8, 0, "Media cancha",
            Section: "Principal",
            Methodology: "Integrado",
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null,
            MicrocicloId: null,
            ModelLinks: modelLinks,
            Habilidades: habilidades)
        { UserId = userId };

        [Fact]
        public async Task Create_WithModelLinksAndHabilidades_PersistsThem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            var (subprincipioId, subSubPrincipioId) = await SeedAdnNodesAsync(seedDb, clubId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCommand(
                clubId, userId,
                modelLinks: new List<ExerciseModelLinkRequest>
                {
                    new(subprincipioId, null, true),
                    new(null, subSubPrincipioId, false)
                },
                habilidades: new List<string> { "Pase", "Centro" });

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelLinks)
                .SingleAsync(e => e.Id == id);

            Assert.Equal(2, exercise.ModelLinks.Count);
            Assert.Contains(exercise.ModelLinks, l => l.SubprincipioId == subprincipioId && l.IsFoco);
            Assert.Contains(exercise.ModelLinks, l => l.SubSubPrincipioId == subSubPrincipioId && !l.IsFoco);
            Assert.Equal(new List<string> { "Pase", "Centro" }, exercise.Habilidades);
        }

        [Fact]
        public async Task Create_WithoutModelLinksOrHabilidades_LeavesThemEmpty()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var id = await handler.Handle(BaseCommand(clubId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelLinks)
                .SingleAsync(e => e.Id == id);

            Assert.Empty(exercise.ModelLinks);
            Assert.Empty(exercise.Habilidades);
        }

        [Fact]
        public async Task Update_ReplacesModelLinks_AddsAndRemoves()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            var (firstSubprincipioId, _) = await SeedAdnNodesAsync(seedDb, clubId);
            var (secondSubprincipioId, _) = await SeedAdnNodesAsync(seedDb, clubId);

            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(
                BaseCommand(clubId, userId, modelLinks: new List<ExerciseModelLinkRequest> { new(firstSubprincipioId, null, true) }),
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio actualizado", "Descripción", new List<string> { "Physical" },
                10, 8, 0, "Media cancha", "Principal", "Integrado", null,
                null, null, null, null, null,
                MicrocicloId: null,
                ModelLinks: new List<ExerciseModelLinkRequest> { new(secondSubprincipioId, null, false) },
                Habilidades: new List<string> { "Remate" })
            { Id = id, UserId = userId };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelLinks)
                .SingleAsync(e => e.Id == id);

            var link = Assert.Single(exercise.ModelLinks);
            Assert.Equal(secondSubprincipioId, link.SubprincipioId);
            Assert.False(link.IsFoco);
            Assert.Equal(new List<string> { "Remate" }, exercise.Habilidades);
        }

        [Fact]
        public async Task Update_WithEmptyModelLinksAndHabilidades_RemovesAll()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            var (subprincipioId, _) = await SeedAdnNodesAsync(seedDb, clubId);

            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(
                BaseCommand(clubId, userId,
                    modelLinks: new List<ExerciseModelLinkRequest> { new(subprincipioId, null, true) },
                    habilidades: new List<string> { "Pase" }),
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio actualizado", "Descripción", new List<string> { "Physical" },
                10, 8, 0, "Media cancha", "Principal", "Integrado", null,
                null, null, null, null, null,
                MicrocicloId: null,
                ModelLinks: new List<ExerciseModelLinkRequest>(),
                Habilidades: new List<string>())
            { Id = id, UserId = userId };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelLinks)
                .SingleAsync(e => e.Id == id);

            Assert.Empty(exercise.ModelLinks);
            Assert.Empty(exercise.Habilidades);
        }

        [Fact]
        public void Validator_RejectsLinkWithBothParentsSet()
        {
            var validator = new ExerciseModelLinkRequestValidator();
            var result = validator.Validate(new ExerciseModelLinkRequest("sub-1", "subsub-1", true));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_RejectsLinkWithNeitherParentSet()
        {
            var validator = new ExerciseModelLinkRequestValidator();
            var result = validator.Validate(new ExerciseModelLinkRequest(null, null, true));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_AcceptsLinkWithExactlyOneParentSet()
        {
            var validator = new ExerciseModelLinkRequestValidator();
            var result = validator.Validate(new ExerciseModelLinkRequest("sub-1", null, true));
            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task CreateValidator_RejectsNonVocabularyHabilidad()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, habilidades: new List<string> { "Regate" });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task CreateValidator_RejectsModelLinkWithBothParentsSet()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, modelLinks: new List<ExerciseModelLinkRequest> { new("sub-1", "subsub-1", true) });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task CreateValidator_AcceptsValidModelLinksAndHabilidades()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            var command = BaseCommand(
                clubId, userId,
                modelLinks: new List<ExerciseModelLinkRequest> { new("sub-1", null, true) },
                habilidades: new List<string> { "Pase" });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task GetExercises_ResolvesModelLinkSummaries()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            var (subprincipioId, subSubPrincipioId) = await SeedAdnNodesAsync(seedDb, clubId);

            await using var createDb = _fixture.CreateDbContext();
            await new CreateExerciseHandler(createDb).Handle(
                BaseCommand(
                    clubId, userId,
                    modelLinks: new List<ExerciseModelLinkRequest>
                    {
                        new(subprincipioId, null, true),
                        new(null, subSubPrincipioId, false)
                    },
                    habilidades: new List<string> { "Pase" }),
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(
                new GetExercisesQuery(clubId, Methodology: null, UserId: userId),
                CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(2, item.ModelLinks.Count());
            var subprincipioLink = item.ModelLinks.Single(l => l.SubprincipioId == subprincipioId);
            Assert.Equal("1.1", subprincipioLink.SubprincipioNumero);
            Assert.Equal("Subprincipio", subprincipioLink.SubprincipioTitulo);
            Assert.True(subprincipioLink.IsFoco);
            var subSubPrincipioLink = item.ModelLinks.Single(l => l.SubSubPrincipioId == subSubPrincipioId);
            Assert.Equal("1.1.1", subSubPrincipioLink.SubSubPrincipioNumero);
            Assert.Equal("Rol", subSubPrincipioLink.SubSubPrincipioRol);
            Assert.False(subSubPrincipioLink.IsFoco);
            Assert.Equal(new List<string> { "Pase" }, item.Habilidades);
        }

        [Fact]
        public async Task GetExercises_WithNoModelLinks_ReturnsEmptyNotNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            await new CreateExerciseHandler(createDb).Handle(BaseCommand(clubId, userId), CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(
                new GetExercisesQuery(clubId, Methodology: null, UserId: userId),
                CancellationToken.None);

            var item = Assert.Single(result);
            Assert.NotNull(item.ModelLinks);
            Assert.Empty(item.ModelLinks);
            Assert.NotNull(item.Habilidades);
            Assert.Empty(item.Habilidades);
        }

        [Fact]
        public async Task GetExerciseById_ResolvesModelLinkSummaries()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            var (subprincipioId, _) = await SeedAdnNodesAsync(seedDb, clubId);

            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(
                BaseCommand(clubId, userId, modelLinks: new List<ExerciseModelLinkRequest> { new(subprincipioId, null, true) }),
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExerciseByIdHandler(queryDb).Handle(new GetExerciseByIdQuery(id, userId), CancellationToken.None);

            Assert.NotNull(result);
            var link = Assert.Single(result!.ModelLinks);
            Assert.Equal(subprincipioId, link.SubprincipioId);
            Assert.Equal("1.1", link.SubprincipioNumero);
        }

        [Fact]
        public async Task GetExerciseById_WithNoModelLinks_ReturnsEmptyNotNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(BaseCommand(clubId, userId), CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExerciseByIdHandler(queryDb).Handle(new GetExerciseByIdQuery(id, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.NotNull(result!.ModelLinks);
            Assert.Empty(result.ModelLinks);
            Assert.NotNull(result.Habilidades);
            Assert.Empty(result.Habilidades);
        }
    }
}
