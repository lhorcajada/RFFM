#nullable enable
using RFFM.Api.Features.Coaches.GameModels.Assistant;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GameModelAssistantEnvelopeTests
    {
        private const string ValidProposal = """
            {
              "kind": "proposal",
              "message": "Añado un subprincipio.",
              "changes": [
                {
                  "id": "c1",
                  "operation": "add",
                  "nodeType": "subprincipio",
                  "parentAddress": "defensa-organizada-1",
                  "fields": { "numero": "1.2", "titulo": "Nuevo", "texto": "Texto" }
                }
              ]
            }
            """;

        [Fact]
        public void TryParse_ReturnsTrue_ForProposalMatchingTheSchema()
        {
            var parsed = GameModelAssistantEnvelope.TryParse(ValidProposal, out var envelope, out var error);

            Assert.True(parsed);
            Assert.NotNull(envelope);
            Assert.Null(error);
            Assert.Equal(AssistantReplyKind.Proposal, envelope!.Kind);
            Assert.Single(envelope.Changes);
        }

        [Fact]
        public void TryParse_ReturnsFalse_ForUnknownKind()
        {
            var json = ValidProposal.Replace("\"kind\": \"proposal\"", "\"kind\": \"opinion\"");

            var parsed = GameModelAssistantEnvelope.TryParse(json, out var envelope, out var error);

            Assert.False(parsed);
            Assert.NotNull(error);
            Assert.Null(envelope);
        }

        [Fact]
        public void TryParse_ReturnsFalse_ForUnknownMember()
        {
            var json = ValidProposal.Replace("\"message\":", "\"extra\": true, \"message\":");

            var parsed = GameModelAssistantEnvelope.TryParse(json, out var envelope, out var error);

            Assert.False(parsed);
            Assert.NotNull(error);
            Assert.Null(envelope);
        }

        [Fact]
        public void TryParse_ReturnsFalse_ForUnknownOperation()
        {
            var json = ValidProposal.Replace("\"operation\": \"add\"", "\"operation\": \"delete\"");

            var parsed = GameModelAssistantEnvelope.TryParse(json, out var envelope, out var error);

            Assert.False(parsed);
            Assert.NotNull(error);
            Assert.Null(envelope);
        }

        [Fact]
        public void TryParse_ReturnsFalse_WhenFieldsIsNotAnObject()
        {
            var json = ValidProposal.Replace("\"fields\": { \"numero\": \"1.2\", \"titulo\": \"Nuevo\", \"texto\": \"Texto\" }", "\"fields\": \"texto\"");

            var parsed = GameModelAssistantEnvelope.TryParse(json, out var envelope, out var error);

            Assert.False(parsed);
            Assert.NotNull(error);
            Assert.Null(envelope);
        }

        [Fact]
        public void TryParse_ParsesQuestionWithEmptyChanges()
        {
            const string question = """
                {
                  "kind": "question",
                  "message": "¿Qué zona quieres revisar?",
                  "changes": []
                }
                """;

            var parsed = GameModelAssistantEnvelope.TryParse(question, out var envelope, out _);

            Assert.True(parsed);
            Assert.NotNull(envelope);
            Assert.Equal(AssistantReplyKind.Question, envelope!.Kind);
            Assert.Empty(envelope.Changes);
        }

        [Fact]
        public void TryParse_ReturnsFalseWithError_ForQuestionThatCarriesChanges()
        {
            const string question = """
                {
                  "kind": "question",
                  "message": "¿Qué zona quieres revisar?",
                  "changes": [
                    {
                      "id": "c1",
                      "operation": "add",
                      "nodeType": "subprincipio",
                      "parentAddress": "defensa-organizada-1",
                      "fields": { "numero": "1.2", "titulo": "Nuevo" }
                    }
                  ]
                }
                """;

            var parsed = GameModelAssistantEnvelope.TryParse(question, out var envelope, out var error);

            Assert.False(parsed);
            Assert.NotNull(error);
            Assert.Null(envelope);
        }
    }
}
