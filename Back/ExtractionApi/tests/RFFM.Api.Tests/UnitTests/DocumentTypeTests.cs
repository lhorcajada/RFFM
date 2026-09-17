#nullable enable
using RFFM.Api.Domain.Entities.PlayerDocuments;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class DocumentTypeTests
    {
        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_RequiresName(string name)
        {
            Assert.Throws<ArgumentException>(() => DocumentType.Create(name, "some description"));
        }

        [Fact]
        public void Create_PersistsNameDescriptionAndDefaultsIsActiveTrue()
        {
            var type = DocumentType.Create("Autorización físico", "Autorización para entrenar fuera de las instalaciones");

            Assert.Equal("Autorización físico", type.Name);
            Assert.Equal("Autorización para entrenar fuera de las instalaciones", type.Description);
            Assert.True(type.IsActive);
        }

        [Fact]
        public void Create_AllowsNullDescription()
        {
            var type = DocumentType.Create("Autorización físico", null);

            Assert.Null(type.Description);
        }
    }
}
