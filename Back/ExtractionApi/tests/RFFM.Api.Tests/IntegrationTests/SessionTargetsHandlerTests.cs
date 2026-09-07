#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for the `season-plan-content-board` change: unscheduled ("content-first")
    /// sessions, Sub-subprincipio session targets, target team-ownership validation, and
    /// automatic Microciclo resolution by date on Create/Update session.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SessionTargetsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SessionTargetsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId, string SeasonId)> SeedTeamAsync(AppDbContext db, string? suffix = null)
        {
            var club = Club.Create($"SessionTargets Test Club {suffix}{Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "SessionTargets Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id, season.Id);
        }

        private static async Task<string> SeedSubSubPrincipioAsync(AppDbContext db, string teamId)
        {
            var model = new GameModel(teamId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"ssp-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subprincipio.Id, null);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();
            return subSubPrincipio.Id;
        }

        private static async Task<string> SeedMicrocicloAsync(AppDbContext db, string teamId, string seasonId, DateOnly start, DateOnly end)
        {
            var plan = new SeasonPlan(teamId, seasonId);
            var macrociclo = new Macrociclo(plan.Id, 1, "Macrociclo 1", start, end);
            var mesociclo = new Mesociclo(macrociclo.Id, 1, "Mesociclo 1.1", start, end, 2);
            var microciclo = new Microciclo(mesociclo.Id, 1, "Semana 1", start, end);
            mesociclo.Microciclos.Add(microciclo);
            macrociclo.Mesociclos.Add(mesociclo);
            plan.Macrociclos.Add(macrociclo);
            db.SeasonPlans.Add(plan);
            await db.SaveChangesAsync();
            return microciclo.Id;
        }

        private static CreateSessionCommand UnscheduledCommand(string teamId, string userId, List<string>? targetIds = null) => new(
            teamId, "Sesion sin fecha", null, null, null, null, null, null, null, null, null,
            new List<SessionBlockRequest>(), targetIds ?? new List<string>())
        { UserId = userId };

        [Fact]
        public async Task Create_UnscheduledSessionWithNoBlocks_Succeeds()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, _) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var sessionId = await handler.Handle(UnscheduledCommand(teamId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);
            Assert.Null(session.Date);
            Assert.Null(session.StartTime);
            Assert.Null(session.MicrocicloId);
        }

        [Fact]
        public async Task Create_UnscheduledSessionWithTargets_PersistsTargets()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, _) = await SeedTeamAsync(seedDb);
            var subSubPrincipioId = await SeedSubSubPrincipioAsync(seedDb, teamId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var sessionId = await handler.Handle(
                UnscheduledCommand(teamId, userId, new List<string> { subSubPrincipioId }), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.Include(s => s.Targets).SingleAsync(s => s.Id == sessionId);
            var target = Assert.Single(session.Targets);
            Assert.Equal(subSubPrincipioId, target.SubSubPrincipioId);
        }

        [Fact]
        public async Task Create_WithTargetFromAnotherTeamsGameModel_ThrowsTargetNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, _) = await SeedTeamAsync(seedDb, "own-");
            var (_, _, otherTeamId, _) = await SeedTeamAsync(seedDb, "other-");
            var otherTeamSubSubPrincipioId = await SeedSubSubPrincipioAsync(seedDb, otherTeamId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                handler.Handle(UnscheduledCommand(teamId, userId, new List<string> { otherTeamSubSubPrincipioId }), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.TargetNotFound, ex.Code);
        }

        [Fact]
        public async Task Create_WithDateAndNoExplicitMicrociclo_AutoResolvesMicrocicloByDateRange()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId) = await SeedTeamAsync(seedDb);
            var microcicloId = await SeedMicrocicloAsync(seedDb, teamId, seasonId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var command = new CreateSessionCommand(
                teamId, "Sesion con fecha", null, new DateTime(2026, 9, 3, 0, 0, 0, DateTimeKind.Utc), TimeSpan.FromHours(18), null,
                null, null, null, null, null, new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest>())
                })
            { UserId = userId };

            // Blocks must have at least one exercise per SessionBlockRequestValidator — bypass
            // validator here since we're testing the handler directly (mirrors existing
            // CreateSessionHandlerTests convention of exercising handlers without the pipeline).
            var sessionId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);
            Assert.Equal(microcicloId, session.MicrocicloId);
        }

        [Fact]
        public async Task Create_WithDateOutsideAnyMicrocicloRange_LeavesMicrocicloNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId) = await SeedTeamAsync(seedDb);
            await SeedMicrocicloAsync(seedDb, teamId, seasonId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var command = new CreateSessionCommand(
                teamId, "Sesion fuera de rango", null, new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc), TimeSpan.FromHours(18), null,
                null, null, null, null, null, new List<SessionBlockRequest>())
            { UserId = userId };

            var sessionId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);
            Assert.Null(session.MicrocicloId);
        }

        [Fact]
        public async Task Update_ReplacesTargetsWholesale()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, _) = await SeedTeamAsync(seedDb);
            var firstTarget = await SeedSubSubPrincipioAsync(seedDb, teamId);
            var secondTarget = await SeedSubSubPrincipioAsync(seedDb, teamId);

            await using var createDb = _fixture.CreateDbContext();
            var sessionId = await new CreateSessionHandler(createDb).Handle(
                UnscheduledCommand(teamId, userId, new List<string> { firstTarget }), CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateCommand = new UpdateSessionCommand(
                sessionId, "Sesion sin fecha", null, null, null, null, null, null, null, null, null,
                new List<SessionBlockRequest>(), userId, new List<string> { secondTarget });
            await new UpdateSessionHandler(updateDb).Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.Include(s => s.Targets).SingleAsync(s => s.Id == sessionId);
            var target = Assert.Single(session.Targets);
            Assert.Equal(secondTarget, target.SubSubPrincipioId);
        }

        [Fact]
        public async Task Update_WithDateAndNoExplicitMicrociclo_AutoResolvesMicrocicloByDateRange()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId) = await SeedTeamAsync(seedDb);
            var microcicloId = await SeedMicrocicloAsync(seedDb, teamId, seasonId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));

            await using var createDb = _fixture.CreateDbContext();
            var sessionId = await new CreateSessionHandler(createDb).Handle(UnscheduledCommand(teamId, userId), CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateCommand = new UpdateSessionCommand(
                sessionId, "Sesion ahora con fecha", null, new DateTime(2026, 9, 5, 0, 0, 0, DateTimeKind.Utc), TimeSpan.FromHours(18), null,
                null, null, null, null, null, new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest>())
                }, userId);
            await new UpdateSessionHandler(updateDb).Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);
            Assert.Equal(microcicloId, session.MicrocicloId);
        }

        [Fact]
        public void Validator_UnscheduledSessionWithEmptyBlocks_IsValid()
        {
            var command = new CreateSessionCommand(
                "team-1", "Sesion", null, null, null, null, null, null, null, null, null,
                new List<SessionBlockRequest>());

            var result = new CreateSessionValidator().Validate(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validator_ScheduledSessionWithEmptyBlocks_IsInvalid()
        {
            var command = new CreateSessionCommand(
                "team-1", "Sesion", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>());

            var result = new CreateSessionValidator().Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void UpdateValidator_UnscheduledSessionWithEmptyBlocks_IsValid()
        {
            var command = new UpdateSessionCommand(
                "session-1", "Sesion", null, null, null, null, null, null, null, null, null,
                new List<SessionBlockRequest>(), "user-1");

            var result = new UpdateSessionValidator().Validate(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public void UpdateValidator_ScheduledSessionWithEmptyBlocks_IsInvalid()
        {
            var command = new UpdateSessionCommand(
                "session-1", "Sesion", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>(), "user-1");

            var result = new UpdateSessionValidator().Validate(command);

            Assert.False(result.IsValid);
        }
    }
}
