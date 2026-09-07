#nullable enable
using System.Collections.Generic;
using RFFM.Api.Domain.Aggregates.Training;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TrainingSessionSubSubPrincipioTests
    {
        [Fact]
        public void Create_WithValidIds_SetsProperties()
        {
            var target = new TrainingSessionSubSubPrincipio("session-1", "ssp-1");

            Assert.Equal("session-1", target.TrainingSessionId);
            Assert.Equal("ssp-1", target.SubSubPrincipioId);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTrainingSessionId_Throws(string? trainingSessionId)
        {
            Assert.Throws<System.ArgumentException>(() => new TrainingSessionSubSubPrincipio(trainingSessionId!, "ssp-1"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptySubSubPrincipioId_Throws(string? subSubPrincipioId)
        {
            Assert.Throws<System.ArgumentException>(() => new TrainingSessionSubSubPrincipio("session-1", subSubPrincipioId!));
        }
    }

    public class TrainingSessionReplaceTargetsTests
    {
        private static TrainingSession NewSession() => new() { Name = "Sesion", TeamId = "team-1" };

        [Fact]
        public void ReplaceTargets_WithIds_AddsThem()
        {
            var session = NewSession();

            session.ReplaceTargets(new List<string> { "ssp-1", "ssp-2" });

            Assert.Equal(2, session.Targets.Count);
            Assert.Contains(session.Targets, t => t.SubSubPrincipioId == "ssp-1");
            Assert.Contains(session.Targets, t => t.SubSubPrincipioId == "ssp-2");
            Assert.All(session.Targets, t => Assert.Equal(session.Id, t.TrainingSessionId));
        }

        [Fact]
        public void ReplaceTargets_CalledAgain_ClearsAndRebuilds()
        {
            var session = NewSession();
            session.ReplaceTargets(new List<string> { "ssp-1" });

            session.ReplaceTargets(new List<string> { "ssp-2", "ssp-3" });

            Assert.Equal(2, session.Targets.Count);
            Assert.DoesNotContain(session.Targets, t => t.SubSubPrincipioId == "ssp-1");
        }

        [Fact]
        public void ReplaceTargets_WithDuplicateIds_Dedupes()
        {
            var session = NewSession();

            session.ReplaceTargets(new List<string> { "ssp-1", "ssp-1", "ssp-2" });

            Assert.Equal(2, session.Targets.Count);
        }

        [Fact]
        public void ReplaceTargets_WithNull_ClearsToEmpty()
        {
            var session = NewSession();
            session.ReplaceTargets(new List<string> { "ssp-1" });

            session.ReplaceTargets(null);

            Assert.Empty(session.Targets);
        }

        [Fact]
        public void ReplaceTargets_WithEmptyList_ClearsToEmpty()
        {
            var session = NewSession();
            session.ReplaceTargets(new List<string> { "ssp-1" });

            session.ReplaceTargets(new List<string>());

            Assert.Empty(session.Targets);
        }
    }

    public class TrainingSessionNullableScheduleTests
    {
        [Fact]
        public void Session_WithoutDateOrStartTime_IsUnscheduled()
        {
            var session = new TrainingSession { Name = "Sesion", TeamId = "team-1", Date = null, StartTime = null };

            Assert.Null(session.Date);
            Assert.Null(session.StartTime);
        }

        [Fact]
        public void Session_WithDateAndStartTime_IsScheduled()
        {
            var date = new System.DateTime(2026, 9, 10);
            var session = new TrainingSession
            {
                Name = "Sesion", TeamId = "team-1", Date = date, StartTime = System.TimeSpan.FromHours(18)
            };

            Assert.Equal(date, session.Date);
            Assert.Equal(System.TimeSpan.FromHours(18), session.StartTime);
        }
    }
}
