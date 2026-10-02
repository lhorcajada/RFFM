#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.PlayerTracking;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerSessionListHandlerTests
    {
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
        private readonly PostgresContainerFixture _fixture;

        public PlayerSessionListHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<string> SeedSessionAsync(
            AppDbContext db, string teamId, string name, DateTime? date, string? teamPlayerId = null, int? assistanceTypeId = null)
        {
            string? eventId = null;
            if (date is not null && teamPlayerId is not null)
            {
                var sportEvent = SportEvent.CreateNew(name, date.Value, date.Value, null, null, null, null, TrainingEventTypeId, teamId, null);
                db.SportEvents.Add(sportEvent);
                await db.SaveChangesAsync();
                eventId = sportEvent.Id;
                db.Convocations.Add(Convocation.Create(new ConvocationModel
                {
                    EventId = eventId,
                    TeamPlayerId = teamPlayerId,
                    AssistanceTypeId = assistanceTypeId,
                    ResponseDateTime = date.Value,
                    ConvocationStatusId = null,
                    ExcuseTypeId = null
                }));
            }

            var session = new TrainingSession { TeamId = teamId, Name = name, Date = date, SportEventId = eventId };
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();
            return session.Id;
        }

        private static async Task SeedEvaluationAsync(AppDbContext db, string teamId, string teamPlayerId, string sessionId, string subprincipioId)
        {
            var snapshot = (string id, string label) => new SubprincipioSnapshot(id, "Ataque organizado", "2. Ataque posicional", label);
            db.PlayerSessionEvaluations.Add(PlayerSessionEvaluation.Create(
                teamId, teamPlayerId, new SessionSnapshot(sessionId, "Sesión evaluada", new DateOnly(2026, 9, 10)),
                new[]
                {
                    new SubprincipioEvaluationInput(snapshot(subprincipioId, "2.3"), ObservationAssessment.NotAchieved, null),
                },
                "coach-1", new DateOnly(2026, 10, 1)));
            await db.SaveChangesAsync();
        }

        private static Task<GetPlayerSessionEvaluations.PlayerSessionListItemDto[]> ListAsync(AppDbContext db, string teamId, string teamPlayerId) =>
            new GetPlayerSessionEvaluations.Handler(db)
                .Handle(new GetPlayerSessionEvaluations.Query { TeamId = teamId, TeamPlayerId = teamPlayerId }, CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task List_ReturnsSeasonSessionsWithAttendanceAndEvaluationSummary_MostRecentFirst()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, subprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var evaluated = await SeedSessionAsync(db, teamId, "Sesión evaluada", new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc),
                teamPlayerId, AssistanceType.Attendance.Id);
            var missed = await SeedSessionAsync(db, teamId, "Sesión que faltó", new DateTime(2026, 9, 20, 0, 0, 0, DateTimeKind.Utc),
                teamPlayerId, AssistanceType.UnexcusedAbsence.Id);
            var future = await SeedSessionAsync(db, teamId, "Sesión futura", DateTime.UtcNow.Date.AddDays(5));
            await SeedSessionAsync(db, teamId, "Sin programar", null);
            await SeedEvaluationAsync(db, teamId, teamPlayerId, evaluated, subprincipioId);

            var result = await ListAsync(db, teamId, teamPlayerId);

            Assert.Equal(new[] { future, missed, evaluated }, result.Select(r => r.SessionId).ToArray());

            var futureItem = result[0];
            Assert.False(futureItem.IsHeld);
            Assert.False(futureItem.HasCalendarEvent);
            Assert.Null(futureItem.AssistanceTypeId);

            var missedItem = result[1];
            Assert.True(missedItem.IsHeld);
            Assert.True(missedItem.HasCalendarEvent);
            Assert.Equal(AssistanceType.UnexcusedAbsence.Id, missedItem.AssistanceTypeId);
            Assert.Null(missedItem.Evaluation);

            var evaluatedItem = result[2];
            Assert.Equal(new DateOnly(2026, 9, 10), evaluatedItem.Date);
            Assert.Equal(AssistanceType.Attendance.Id, evaluatedItem.AssistanceTypeId);
            Assert.NotNull(evaluatedItem.Evaluation);
            Assert.Equal(0, evaluatedItem.Evaluation!.Achieved);
            Assert.Equal(0, evaluatedItem.Evaluation.Partial);
            Assert.Equal(1, evaluatedItem.Evaluation.NotAchieved);
        }

        [Fact]
        public async Task List_DoesNotIncludeAnotherPlayersEvaluation()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, subprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var teammate = await PlayerModelObservationPersistenceTests.SeedTeammateAsync(db, teamPlayerId);
            var session = await SeedSessionAsync(db, teamId, "Sesión", new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc));
            await SeedEvaluationAsync(db, teamId, teammate, session, subprincipioId);

            var result = await ListAsync(db, teamId, teamPlayerId);

            Assert.Null(Assert.Single(result).Evaluation);
        }

        [Fact]
        public async Task List_PlayerOfAnotherTeam_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var (_, otherTeamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            await Assert.ThrowsAsync<NotFoundException>(() => ListAsync(db, teamId, otherTeamPlayerId));
        }
    }
}
