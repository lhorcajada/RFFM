#nullable enable
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class ExerciseModelLinkTests
    {
        [Fact]
        public void Create_WithSubprincipioIdOnly_SetsProperties()
        {
            var link = new ExerciseModelLink("exercise-1", subprincipioId: "sub-1", subSubPrincipioId: null, isFoco: true);

            Assert.Equal("exercise-1", link.TaskTrainingBaseId);
            Assert.Equal("sub-1", link.SubprincipioId);
            Assert.Null(link.SubSubPrincipioId);
            Assert.True(link.IsFoco);
        }

        [Fact]
        public void Create_WithSubSubPrincipioIdOnly_SetsProperties()
        {
            var link = new ExerciseModelLink("exercise-1", subprincipioId: null, subSubPrincipioId: "subsub-1", isFoco: false);

            Assert.Null(link.SubprincipioId);
            Assert.Equal("subsub-1", link.SubSubPrincipioId);
            Assert.False(link.IsFoco);
        }

        [Fact]
        public void Create_WithBothParentsSet_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new ExerciseModelLink("exercise-1", subprincipioId: "sub-1", subSubPrincipioId: "subsub-1", isFoco: true));
        }

        [Fact]
        public void Create_WithNeitherParentSet_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new ExerciseModelLink("exercise-1", subprincipioId: null, subSubPrincipioId: null, isFoco: true));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTaskTrainingBaseId_Throws(string? taskTrainingBaseId)
        {
            Assert.Throws<ArgumentException>(() =>
                new ExerciseModelLink(taskTrainingBaseId!, subprincipioId: "sub-1", subSubPrincipioId: null, isFoco: true));
        }
    }
}
