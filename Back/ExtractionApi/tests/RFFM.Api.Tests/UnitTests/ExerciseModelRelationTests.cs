#nullable enable
using System.Collections.Generic;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class ExerciseModelRelationTests
    {
        [Fact]
        public void Create_WithSubprincipioId_SetsProperties()
        {
            var relation = new ExerciseModelRelation("exercise-1", "sub-1", isFoco: true,
                habilidadesImprescindibles: new List<string> { "Perfilamiento" });

            Assert.Equal("exercise-1", relation.TaskTrainingBaseId);
            Assert.Equal("sub-1", relation.SubprincipioId);
            Assert.True(relation.IsFoco);
            Assert.Contains("Perfilamiento", relation.HabilidadesImprescindibles);
            Assert.Empty(relation.Items);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptySubprincipioId_Throws(string? subprincipioId)
        {
            Assert.Throws<System.ArgumentException>(() =>
                new ExerciseModelRelation("exercise-1", subprincipioId!, isFoco: true, habilidadesImprescindibles: null));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTaskTrainingBaseId_Throws(string? taskTrainingBaseId)
        {
            Assert.Throws<System.ArgumentException>(() =>
                new ExerciseModelRelation(taskTrainingBaseId!, "sub-1", isFoco: true, habilidadesImprescindibles: null));
        }

        [Fact]
        public void Create_WithInvalidHabilidad_Throws()
        {
            Assert.Throws<System.ArgumentException>(() =>
                new ExerciseModelRelation("exercise-1", "sub-1", isFoco: false,
                    habilidadesImprescindibles: new List<string> { "NotARealHabilidad" }));
        }

        [Fact]
        public void ReplaceItems_ClearsAndRebuilds()
        {
            var relation = new ExerciseModelRelation("exercise-1", "sub-1", isFoco: true, habilidadesImprescindibles: null);
            relation.ReplaceItems(new[] { ("subsub-1", true), ("subsub-2", false) });

            Assert.Equal(2, relation.Items.Count);
            Assert.Contains(relation.Items, i => i.SubSubPrincipioId == "subsub-1" && i.IsFoco);
            Assert.Contains(relation.Items, i => i.SubSubPrincipioId == "subsub-2" && !i.IsFoco);

            relation.ReplaceItems(new[] { ("subsub-3", true) });
            Assert.Single(relation.Items);
            Assert.Equal("subsub-3", relation.Items[0].SubSubPrincipioId);
        }
    }

    public class ExerciseModelRelationItemTests
    {
        [Fact]
        public void Create_WithSubSubPrincipioId_SetsProperties()
        {
            var item = new ExerciseModelRelationItem("relation-1", "subsub-1", isFoco: true);

            Assert.Equal("relation-1", item.ExerciseModelRelationId);
            Assert.Equal("subsub-1", item.SubSubPrincipioId);
            Assert.True(item.IsFoco);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptySubSubPrincipioId_Throws(string? subSubPrincipioId)
        {
            Assert.Throws<System.ArgumentException>(() =>
                new ExerciseModelRelationItem("relation-1", subSubPrincipioId!, isFoco: false));
        }
    }
}
