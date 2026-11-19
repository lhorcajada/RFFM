#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Features.Coaches.GameModels.Assistant
{
    public sealed record ValidatedProposal(IReadOnlyList<AssistantChange> Changes, int DiscardedCount);

    /// <summary>
    /// Keeps the proposed changes that the loaded model can take and counts the rest. A change is
    /// discarded when it points to a missing node, carries a field the saving rules reject, breaks
    /// the parent rule, repeats a change id or a node address already kept. Adds hang from an
    /// existing node or from an earlier kept add of the same proposal.
    /// </summary>
    public static class GameModelProposalValidator
    {
        private const string SetPiecesAddress = "set-pieces";

        private enum FieldKind { Text, NonEmptyText, Integer, GameMoment, Choice, ZoneKeys }

        private sealed record FieldRule(FieldKind Kind, bool Required, IReadOnlySet<string>? Choices = null);

        private static readonly IReadOnlySet<AssistantNodeType> NoParentTypes = new HashSet<AssistantNodeType>();

        private static readonly IReadOnlyDictionary<AssistantNodeType, IReadOnlySet<AssistantNodeType>> ParentTypes =
            new Dictionary<AssistantNodeType, IReadOnlySet<AssistantNodeType>>
            {
                [AssistantNodeType.Subprincipio] = new HashSet<AssistantNodeType> { AssistantNodeType.Principio },
                [AssistantNodeType.Zona] = new HashSet<AssistantNodeType> { AssistantNodeType.Subprincipio },
                [AssistantNodeType.SubSubPrincipio] = new HashSet<AssistantNodeType> { AssistantNodeType.Subprincipio, AssistantNodeType.Zona },
                [AssistantNodeType.Habilidad] = new HashSet<AssistantNodeType> { AssistantNodeType.SubSubPrincipio },
                [AssistantNodeType.Nota] = new HashSet<AssistantNodeType>
                {
                    AssistantNodeType.Principio,
                    AssistantNodeType.Subprincipio,
                    AssistantNodeType.Zona,
                    AssistantNodeType.SubSubPrincipio,
                },
            };

        // Mirrors the editable fields of UpdateGameModelRequest (camelCase JSON names).
        private static readonly IReadOnlyDictionary<AssistantNodeType, IReadOnlyDictionary<string, FieldRule>> FieldRules =
            new Dictionary<AssistantNodeType, IReadOnlyDictionary<string, FieldRule>>
            {
                [AssistantNodeType.Principio] = new Dictionary<string, FieldRule>
                {
                    ["gameMomentId"] = new(FieldKind.GameMoment, Required: true),
                    ["numero"] = new(FieldKind.Integer, Required: true),
                    ["titulo"] = new(FieldKind.NonEmptyText, Required: true),
                    ["texto"] = new(FieldKind.Text, Required: false),
                },
                [AssistantNodeType.Subprincipio] = new Dictionary<string, FieldRule>
                {
                    ["numero"] = new(FieldKind.NonEmptyText, Required: true),
                    ["titulo"] = new(FieldKind.NonEmptyText, Required: true),
                    ["texto"] = new(FieldKind.Text, Required: false),
                },
                [AssistantNodeType.Zona] = new Dictionary<string, FieldRule>
                {
                    ["zoneKeysCsv"] = new(FieldKind.ZoneKeys, Required: true),
                    ["label"] = new(FieldKind.Text, Required: false),
                    ["zonaTexto"] = new(FieldKind.Text, Required: false),
                    ["texto"] = new(FieldKind.Text, Required: false),
                },
                [AssistantNodeType.SubSubPrincipio] = new Dictionary<string, FieldRule>
                {
                    ["numero"] = new(FieldKind.NonEmptyText, Required: true),
                    ["rol"] = new(FieldKind.NonEmptyText, Required: true),
                    ["texto"] = new(FieldKind.Text, Required: false),
                },
                [AssistantNodeType.Habilidad] = new Dictionary<string, FieldRule>
                {
                    ["nombre"] = new(FieldKind.Choice, Required: true, Choices: Habilidad.Vocabulary),
                    ["descripcion"] = new(FieldKind.Text, Required: false),
                    ["entrenable"] = new(FieldKind.Text, Required: false),
                    ["referenciaAKey"] = new(FieldKind.Text, Required: false),
                },
                [AssistantNodeType.Nota] = new Dictionary<string, FieldRule>
                {
                    ["tipo"] = new(FieldKind.Choice, Required: true, Choices: Nota.Tipos),
                    ["texto"] = new(FieldKind.Text, Required: false),
                },
                [AssistantNodeType.SetPieceRule] = new Dictionary<string, FieldRule>
                {
                    ["subtype"] = new(FieldKind.Choice, Required: true, Choices: SetPieceRule.Subtypes),
                    ["texto"] = new(FieldKind.Text, Required: false),
                },
            };

        public static ValidatedProposal Validate(GameModel model, AssistantEnvelope envelope)
        {
            var existing = IndexNodes(GameModelNodeAddresses.List(model));
            var kept = new List<AssistantChange>();
            var seenChangeIds = new HashSet<string>();
            var changedAddresses = new HashSet<string>();
            var addedNodeTypes = new Dictionary<string, AssistantNodeType>();
            var discardedCount = 0;

            foreach (var change in envelope.Changes)
            {
                if (!seenChangeIds.Add(change.Id))
                {
                    discardedCount++;
                    continue;
                }

                var isAdd = change.Operation == AssistantOperation.Add;
                var keep = isAdd
                    ? IsValidAdd(change, existing, addedNodeTypes)
                    : IsValidExistingNodeChange(change, existing, changedAddresses);
                if (!keep)
                {
                    discardedCount++;
                    continue;
                }

                if (isAdd)
                    addedNodeTypes[change.Id] = change.NodeType;
                else
                    changedAddresses.Add(change.Address!);

                kept.Add(change);
            }

            return new ValidatedProposal(kept, discardedCount);
        }

        private static Dictionary<string, NodeAddress> IndexNodes(IEnumerable<NodeAddress> nodes)
        {
            var index = new Dictionary<string, NodeAddress>();
            foreach (var node in nodes)
                index.TryAdd(node.Address, node);
            return index;
        }

        private static bool IsValidAdd(
            AssistantChange change,
            IReadOnlyDictionary<string, NodeAddress> existing,
            IReadOnlyDictionary<string, AssistantNodeType> addedNodeTypes) =>
            change.Address is null
            && HasValidParent(change, existing, addedNodeTypes)
            && HasValidFields(change, isAdd: true);

        private static bool IsValidExistingNodeChange(
            AssistantChange change,
            IReadOnlyDictionary<string, NodeAddress> existing,
            ISet<string> changedAddresses)
        {
            if (change.Address is null || change.ParentAddress is not null || change.ParentChangeId is not null)
                return false;

            if (!existing.TryGetValue(change.Address, out var node) || node.NodeType != change.NodeType)
                return false;

            if (changedAddresses.Contains(change.Address))
                return false;

            return change.Operation switch
            {
                AssistantOperation.Change => HasValidFields(change, isAdd: false),
                AssistantOperation.Remove => change.Fields.Count == 0,
                _ => false,
            };
        }

        private static bool HasValidParent(
            AssistantChange change,
            IReadOnlyDictionary<string, NodeAddress> existing,
            IReadOnlyDictionary<string, AssistantNodeType> addedNodeTypes)
        {
            if (change.NodeType == AssistantNodeType.SetPieceRule)
                return change.ParentChangeId is null
                    && (change.ParentAddress is null || change.ParentAddress == SetPiecesAddress);

            var allowedParents = ParentTypes.TryGetValue(change.NodeType, out var parentTypes) ? parentTypes : NoParentTypes;
            var hasParentChangeId = change.ParentChangeId is not null;
            var hasParentAddress = change.ParentAddress is not null;

            if (allowedParents.Count == 0)
                return !hasParentChangeId && !hasParentAddress;

            if (hasParentChangeId == hasParentAddress)
                return false;

            if (hasParentChangeId)
                return addedNodeTypes.TryGetValue(change.ParentChangeId!, out var addedType) && allowedParents.Contains(addedType);

            return existing.TryGetValue(change.ParentAddress!, out var parent) && allowedParents.Contains(parent.NodeType);
        }

        private static bool HasValidFields(AssistantChange change, bool isAdd)
        {
            var rules = FieldRules[change.NodeType];
            if (!isAdd && change.Fields.Count == 0)
                return false;

            if (change.Fields.Keys.Any(name => !rules.ContainsKey(name)))
                return false;

            foreach (var (name, rule) in rules)
            {
                if (!change.Fields.TryGetValue(name, out var value))
                {
                    if (isAdd && rule.Required)
                        return false;
                    continue;
                }

                if (!MatchesRule(rule, value))
                    return false;
            }

            return !(isAdd && change.NodeType == AssistantNodeType.Zona && IsCompuestaWithoutTexto(change));
        }

        private static bool MatchesRule(FieldRule rule, JsonElement value) => rule.Kind switch
        {
            FieldKind.Text => value.ValueKind == JsonValueKind.String,
            FieldKind.NonEmptyText => value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()),
            FieldKind.Integer => value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out _),
            FieldKind.GameMoment => value.ValueKind == JsonValueKind.Number
                && value.TryGetInt32(out var gameMomentId)
                && GameModelKeys.FaseSlugsById.ContainsKey(gameMomentId),
            FieldKind.Choice => value.ValueKind == JsonValueKind.String && rule.Choices!.Contains(value.GetString()!),
            FieldKind.ZoneKeys => value.ValueKind == JsonValueKind.String && AreKnownZoneKeys(value.GetString()!),
            _ => false,
        };

        private static bool AreKnownZoneKeys(string zoneKeysCsv)
        {
            var tokens = zoneKeysCsv.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            return tokens.Length > 0 && tokens.All(token => Zona.KnownZoneKeys.Contains(token));
        }

        // A "compuesta" zone needs its free text, as the Zona domain entity requires. Checked on adds
        // only: a change may leave zoneKeysCsv alone and rely on text already stored on the zona.
        private static bool IsCompuestaWithoutTexto(AssistantChange change)
        {
            var isCompuesta = change.Fields.TryGetValue("zoneKeysCsv", out var keys)
                && keys.GetString()!.Split(',', StringSplitOptions.TrimEntries).Contains("compuesta");
            if (!isCompuesta)
                return false;

            return !(change.Fields.TryGetValue("zonaTexto", out var texto) && !string.IsNullOrWhiteSpace(texto.GetString()));
        }
    }
}
