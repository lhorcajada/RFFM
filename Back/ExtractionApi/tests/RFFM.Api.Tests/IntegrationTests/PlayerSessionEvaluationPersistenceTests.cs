#nullable enable
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerSessionEvaluationPersistenceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PlayerSessionEvaluationPersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task DeletingTheSession_KeepsTheEvaluationWithItsSnapshot()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, subprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var session = new TrainingSession { TeamId = teamId, Name = "10. Desorganizar rival", Date = new DateTime(2026, 9, 14, 0, 0, 0, DateTimeKind.Utc) };
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();

            var evaluation = PlayerSessionEvaluation.Create(
                teamId, teamPlayerId, new SessionSnapshot(session.Id, session.Name, new DateOnly(2026, 9, 14)),
                new[]
                {
                    new SubprincipioEvaluationInput(
                        new SubprincipioSnapshot(subprincipioId, "Ataque organizado", "2. Ataque posicional", "2.3 Circular para desordenar"),
                        ObservationAssessment.NotAchieved, "Busca el pase vertical")
                },
                "coach-1", new DateOnly(2026, 10, 1));
            db.PlayerSessionEvaluations.Add(evaluation);
            await db.SaveChangesAsync();

            db.TrainingSessions.Remove(session);
            await db.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.PlayerSessionEvaluations
                .AsNoTracking()
                .Include(e => e.Subprincipios)
                .SingleAsync(e => e.Id == evaluation.Id);
            Assert.Null(stored.TrainingSessionId);
            Assert.Equal("10. Desorganizar rival", stored.SessionName);
            Assert.Equal(new DateOnly(2026, 9, 14), stored.SessionDate);
            var item = Assert.Single(stored.Subprincipios);
            Assert.Equal("2.3 Circular para desordenar", item.SubprincipioLabel);
            Assert.Equal(ObservationAssessment.NotAchieved, item.Assessment);
        }

        [Fact]
        public async Task DeletingTheCatalogComment_KeepsTheCommentEvaluationWithItsTitle()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var comment = TrackingComment.Create(teamId, "Implicación defensiva", null, "coach-1");
            db.TrackingComments.Add(comment);
            var session = new TrainingSession { TeamId = teamId, Name = "Sesión", Date = new DateTime(2026, 9, 14, 0, 0, 0, DateTimeKind.Utc) };
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();

            var evaluation = PlayerSessionEvaluation.Create(
                teamId, teamPlayerId, new SessionSnapshot(session.Id, session.Name, new DateOnly(2026, 9, 14)),
                Enumerable.Empty<SubprincipioEvaluationInput>(), "coach-1", new DateOnly(2026, 10, 1),
                new[] { new CommentEvaluationInput(comment.Id, comment.Title, ObservationAssessment.NotAchieved, "No ayuda atrás") });
            db.PlayerSessionEvaluations.Add(evaluation);
            await db.SaveChangesAsync();

            db.TrackingComments.Remove(comment);
            await db.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.PlayerSessionEvaluations
                .AsNoTracking()
                .Include(e => e.Comments)
                .SingleAsync(e => e.Id == evaluation.Id);
            var item = Assert.Single(stored.Comments);
            Assert.Null(item.TrackingCommentId);
            Assert.Equal("Implicación defensiva", item.Title);
            Assert.Equal("No ayuda atrás", item.Note);
        }
    }
}
