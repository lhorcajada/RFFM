#nullable enable
using System.Linq;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers Amendment 2's direct Exercise-GameModel link: <see cref="TaskTrainingBase.ModelLinks"/>
    /// and <see cref="TaskTrainingBase.Habilidades"/>.
    /// </summary>
    public class TaskTrainingBaseModelLinkTests
    {
        [Fact]
        public void UpdateHabilidades_WithVocabularyNames_Succeeds()
        {
            var exercise = new TaskTrainingBase();

            exercise.UpdateHabilidades(new[] { "Pase", "Centro" });

            Assert.Equal(2, exercise.Habilidades.Count);
            Assert.Contains("Pase", exercise.Habilidades);
            Assert.Contains("Centro", exercise.Habilidades);
        }

        [Fact]
        public void UpdateHabilidades_WithNonVocabularyName_Throws()
        {
            var exercise = new TaskTrainingBase();

            Assert.Throws<ArgumentException>(() => exercise.UpdateHabilidades(new[] { "Regate" }));
        }

        [Fact]
        public void UpdateHabilidades_WithNull_ResultsInEmptyList()
        {
            var exercise = new TaskTrainingBase();
            exercise.UpdateHabilidades(new[] { "Pase" });

            exercise.UpdateHabilidades(null);

            Assert.Empty(exercise.Habilidades);
        }

        [Fact]
        public void ReplaceModelLinks_ClearsAndRebuilds()
        {
            var exercise = new TaskTrainingBase();
            exercise.ReplaceModelLinks(new (string? SubprincipioId, string? SubSubPrincipioId, bool IsFoco)[]
            {
                ("sub-1", null, true)
            });
            Assert.Single(exercise.ModelLinks);

            exercise.ReplaceModelLinks(new (string? SubprincipioId, string? SubSubPrincipioId, bool IsFoco)[]
            {
                (null, "subsub-1", false),
                ("sub-2", null, true)
            });

            Assert.Equal(2, exercise.ModelLinks.Count);
            Assert.DoesNotContain(exercise.ModelLinks, l => l.SubprincipioId == "sub-1");
            Assert.Contains(exercise.ModelLinks, l => l.SubSubPrincipioId == "subsub-1" && !l.IsFoco);
            Assert.Contains(exercise.ModelLinks, l => l.SubprincipioId == "sub-2" && l.IsFoco);
        }

        [Fact]
        public void ReplaceModelLinks_WithEmptyList_RemovesAll()
        {
            var exercise = new TaskTrainingBase();
            exercise.ReplaceModelLinks(new (string? SubprincipioId, string? SubSubPrincipioId, bool IsFoco)[]
            {
                ("sub-1", null, true)
            });

            exercise.ReplaceModelLinks(Enumerable.Empty<(string?, string?, bool)>());

            Assert.Empty(exercise.ModelLinks);
        }

        [Fact]
        public void ReplaceModelLinks_WithBothParentsSetOnALink_Throws()
        {
            var exercise = new TaskTrainingBase();

            Assert.Throws<ArgumentException>(() => exercise.ReplaceModelLinks(new (string? SubprincipioId, string? SubSubPrincipioId, bool IsFoco)[]
            {
                ("sub-1", "subsub-1", true)
            }));
        }

        [Fact]
        public void ReplaceModelLinks_WithNeitherParentSetOnALink_Throws()
        {
            var exercise = new TaskTrainingBase();

            Assert.Throws<ArgumentException>(() => exercise.ReplaceModelLinks(new (string? SubprincipioId, string? SubSubPrincipioId, bool IsFoco)[]
            {
                (null, null, true)
            }));
        }
    }
}
