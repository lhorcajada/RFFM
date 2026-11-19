#nullable enable
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;

namespace RFFM.Api.Features.Coaches.GameModels.Assistant
{
    public enum AssistantReplyKind { Question, Proposal }

    public enum AssistantOperation { Add, Change, Remove }

    public sealed record AssistantChange(
        string Id,
        AssistantOperation Operation,
        AssistantNodeType NodeType,
        string? Address,
        string? ParentAddress,
        string? ParentChangeId,
        IReadOnlyDictionary<string, JsonElement> Fields);

    public sealed record AssistantEnvelope(AssistantReplyKind Kind, string Message, IReadOnlyList<AssistantChange> Changes);

    /// <summary>
    /// Strict reader for the provider's reply. The members, enum values and field value types it
    /// accepts are the ones <see cref="JsonSchema"/> declares; the schema is what the provider is
    /// asked to follow, and this reader is what enforces it.
    /// </summary>
    public static class GameModelAssistantEnvelope
    {
        public const string JsonSchema = """
            {
              "$schema": "https://json-schema.org/draft/2020-12/schema",
              "type": "object",
              "additionalProperties": false,
              "required": ["kind", "message", "changes"],
              "properties": {
                "kind": { "type": "string", "enum": ["question", "proposal"] },
                "message": { "type": "string", "minLength": 1 },
                "changes": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["id", "operation", "nodeType", "fields"],
                    "properties": {
                      "id": { "type": "string", "minLength": 1 },
                      "operation": { "type": "string", "enum": ["add", "change", "remove"] },
                      "nodeType": {
                        "type": "string",
                        "enum": ["principio", "subprincipio", "zona", "subSubPrincipio", "habilidad", "nota", "setPieceRule"]
                      },
                      "address": { "type": ["string", "null"] },
                      "parentAddress": { "type": ["string", "null"] },
                      "parentChangeId": { "type": ["string", "null"] },
                      "fields": {
                        "type": "object",
                        "additionalProperties": { "type": ["string", "number"] }
                      }
                    }
                  }
                }
              },
              "allOf": [
                {
                  "if": { "properties": { "kind": { "const": "question" } }, "required": ["kind"] },
                  "then": { "properties": { "changes": { "maxItems": 0 } } }
                }
              ]
            }
            """;

        private static readonly string[] RootMembers = { "kind", "message", "changes" };
        private static readonly string[] ChangeMembers = { "id", "operation", "nodeType", "address", "parentAddress", "parentChangeId", "fields" };

        private static readonly IReadOnlyDictionary<string, AssistantReplyKind> ReplyKinds = new Dictionary<string, AssistantReplyKind>
        {
            ["question"] = AssistantReplyKind.Question,
            ["proposal"] = AssistantReplyKind.Proposal,
        };

        private static readonly IReadOnlyDictionary<string, AssistantOperation> Operations = new Dictionary<string, AssistantOperation>
        {
            ["add"] = AssistantOperation.Add,
            ["change"] = AssistantOperation.Change,
            ["remove"] = AssistantOperation.Remove,
        };

        private static readonly IReadOnlyDictionary<string, AssistantNodeType> NodeTypes = new Dictionary<string, AssistantNodeType>
        {
            ["principio"] = AssistantNodeType.Principio,
            ["subprincipio"] = AssistantNodeType.Subprincipio,
            ["zona"] = AssistantNodeType.Zona,
            ["subSubPrincipio"] = AssistantNodeType.SubSubPrincipio,
            ["habilidad"] = AssistantNodeType.Habilidad,
            ["nota"] = AssistantNodeType.Nota,
            ["setPieceRule"] = AssistantNodeType.SetPieceRule,
        };

        public static bool TryParse(string json, out AssistantEnvelope? envelope, out string? error)
        {
            envelope = null;
            try
            {
                using var document = JsonDocument.Parse(json);
                return TryParseEnvelope(document.RootElement, out envelope, out error);
            }
            catch (JsonException)
            {
                error = "The reply is not valid JSON.";
                return false;
            }
        }

        private static bool TryParseEnvelope(JsonElement root, out AssistantEnvelope? envelope, out string? error)
        {
            envelope = null;
            if (!TryReadObject(root, RootMembers, "reply", out var members, out error))
                return false;

            if (!TryReadRequiredString(members, "kind", "reply", out var kindText, out error))
                return false;
            if (!ReplyKinds.TryGetValue(kindText, out var kind))
            {
                error = $"Unknown reply kind '{kindText}'.";
                return false;
            }

            if (!TryReadRequiredString(members, "message", "reply", out var message, out error))
                return false;

            if (!TryGetRequired(members, "changes", "reply", out var changesElement, out error))
                return false;
            if (changesElement.ValueKind != JsonValueKind.Array)
            {
                error = "'changes' must be an array in the reply.";
                return false;
            }

            var changes = new List<AssistantChange>();
            foreach (var changeElement in changesElement.EnumerateArray())
            {
                if (!TryParseChange(changeElement, out var change, out error))
                    return false;
                changes.Add(change);
            }

            if (kind == AssistantReplyKind.Question && changes.Count > 0)
            {
                error = "A question reply must not carry changes.";
                return false;
            }

            envelope = new AssistantEnvelope(kind, message, changes);
            error = null;
            return true;
        }

        private static bool TryParseChange(JsonElement element, [NotNullWhen(true)] out AssistantChange? change, out string? error)
        {
            change = null;
            if (!TryReadObject(element, ChangeMembers, "change", out var members, out error))
                return false;

            if (!TryReadRequiredString(members, "id", "change", out var id, out error))
                return false;

            if (!TryReadRequiredString(members, "operation", "change", out var operationText, out error))
                return false;
            if (!Operations.TryGetValue(operationText, out var operation))
            {
                error = $"Unknown operation '{operationText}'.";
                return false;
            }

            if (!TryReadRequiredString(members, "nodeType", "change", out var nodeTypeText, out error))
                return false;
            if (!NodeTypes.TryGetValue(nodeTypeText, out var nodeType))
            {
                error = $"Unknown node type '{nodeTypeText}'.";
                return false;
            }

            if (!TryReadOptionalString(members, "address", "change", out var address, out error)
                || !TryReadOptionalString(members, "parentAddress", "change", out var parentAddress, out error)
                || !TryReadOptionalString(members, "parentChangeId", "change", out var parentChangeId, out error))
                return false;

            if (!TryReadFields(members, out var fields, out error))
                return false;

            change = new AssistantChange(id, operation, nodeType, address, parentAddress, parentChangeId, fields);
            error = null;
            return true;
        }

        private static bool TryReadFields(Dictionary<string, JsonElement> members, out IReadOnlyDictionary<string, JsonElement> fields, out string? error)
        {
            fields = new Dictionary<string, JsonElement>();
            if (!TryGetRequired(members, "fields", "change", out var fieldsElement, out error))
                return false;
            if (fieldsElement.ValueKind != JsonValueKind.Object)
            {
                error = "'fields' must be an object in the change.";
                return false;
            }

            var values = new Dictionary<string, JsonElement>();
            foreach (var property in fieldsElement.EnumerateObject())
            {
                if (property.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Number))
                {
                    error = $"Field '{property.Name}' must be a string or a number.";
                    return false;
                }
                if (!values.TryAdd(property.Name, property.Value.Clone()))
                {
                    error = $"Duplicate field '{property.Name}' in the change.";
                    return false;
                }
            }

            fields = values;
            error = null;
            return true;
        }

        private static bool TryReadObject(JsonElement element, string[] allowedMembers, string context, out Dictionary<string, JsonElement> members, out string? error)
        {
            members = new Dictionary<string, JsonElement>();
            error = null;
            if (element.ValueKind != JsonValueKind.Object)
            {
                error = $"The {context} must be a JSON object.";
                return false;
            }

            foreach (var property in element.EnumerateObject())
            {
                if (Array.IndexOf(allowedMembers, property.Name) < 0)
                {
                    error = $"Unknown member '{property.Name}' in the {context}.";
                    return false;
                }
                if (!members.TryAdd(property.Name, property.Value))
                {
                    error = $"Duplicate member '{property.Name}' in the {context}.";
                    return false;
                }
            }

            return true;
        }

        private static bool TryGetRequired(Dictionary<string, JsonElement> members, string name, string context, out JsonElement value, out string? error)
        {
            error = null;
            if (members.TryGetValue(name, out value))
                return true;

            error = $"Missing required member '{name}' in the {context}.";
            return false;
        }

        private static bool TryReadRequiredString(Dictionary<string, JsonElement> members, string name, string context, [NotNullWhen(true)] out string? value, out string? error)
        {
            value = null;
            if (!TryGetRequired(members, name, context, out var element, out error))
                return false;

            var text = element.ValueKind == JsonValueKind.String ? element.GetString() : null;
            if (string.IsNullOrEmpty(text))
            {
                error = $"'{name}' must be a non-empty string in the {context}.";
                return false;
            }

            value = text;
            error = null;
            return true;
        }

        private static bool TryReadOptionalString(Dictionary<string, JsonElement> members, string name, string context, out string? value, out string? error)
        {
            value = null;
            error = null;
            if (!members.TryGetValue(name, out var element) || element.ValueKind == JsonValueKind.Null)
                return true;

            if (element.ValueKind != JsonValueKind.String)
            {
                error = $"'{name}' must be a string or null in the {context}.";
                return false;
            }

            value = element.GetString();
            return true;
        }
    }
}
