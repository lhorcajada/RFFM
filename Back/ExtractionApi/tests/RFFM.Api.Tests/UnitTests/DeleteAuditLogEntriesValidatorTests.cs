#nullable enable
using System.Linq;
using RFFM.Api.Features.Audit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class DeleteAuditLogEntriesValidatorTests
    {
        private static DeleteAuditLogEntries.DeleteAuditLogEntriesCommand Command(params string[] ids)
            => new(ids);

        [Fact]
        public void Validate_EmptyList_IsInvalid()
        {
            var result = new DeleteAuditLogEntries.Validator().Validate(Command());

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_MoreThan100Ids_IsInvalid()
        {
            var ids = Enumerable.Range(1, 101).Select(i => $"evt-{i}").ToArray();

            var result = new DeleteAuditLogEntries.Validator().Validate(Command(ids));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_EmptyId_IsInvalid()
        {
            var result = new DeleteAuditLogEntries.Validator().Validate(Command("evt-1", " "));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_RepeatedIds_IsInvalid()
        {
            var result = new DeleteAuditLogEntries.Validator().Validate(Command("evt-1", "evt-1"));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_SingleValidId_IsValid()
        {
            var result = new DeleteAuditLogEntries.Validator().Validate(Command("evt-1"));

            Assert.True(result.IsValid);
        }
    }
}
