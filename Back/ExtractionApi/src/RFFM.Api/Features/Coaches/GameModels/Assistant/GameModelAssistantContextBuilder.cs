#nullable enable
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Features.Coaches.MatchForecast.Services;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Assistant
{
    public sealed record AssistantInjuryContext(string InjuryType, DateOnly StartDate, DateOnly? EndDate, string? EstimatedRecovery);

    public sealed record AssistantPlayerContext(string Alias, IReadOnlyList<AssistantInjuryContext> Injuries, int? Fatigue, int? Readiness, int? FormStatus);

    public sealed record AssistantSessionContext(DateOnly? Date, string? GeneralObjective);

    public sealed record AssistantNodeContext(string Address, AssistantNodeType NodeType, string Text, string Title, string BranchKey);

    public sealed record AssistantContext(string Text, Guid ModelVersion);

    /// <summary>
    /// Builds the text the provider reads about one game model. Every value comes through an allowlist
    /// record: entities and DTOs are never serialized, and identifying data (name, identifiers, contact
    /// data) and injury descriptions are never read into the text.
    /// </summary>
    public sealed class GameModelAssistantContextBuilder(
        AppDbContext db,
        PlayerConditionService conditions,
        OwnTeamForecastService forecasts,
        IOptionsMonitor<GameModelAssistantOptions> options)
    {
        private const string SeasonObjectiveTipo = "objetivo-temporada";

        /// <summary>
        /// Returns the model's marker captured now. When the full text is bigger than the full-detail limit, only the
        /// branches the conversation names (<paramref name="focusTexts"/>, most specific first) keep their full text and
        /// the others are reduced to their titles. Throws rather than truncating when the text is still over the limit.
        /// </summary>
        public async Task<AssistantContext> BuildAsync(GameModel model, string teamId, CancellationToken ct,
            IReadOnlyList<string>? focusTexts = null)
        {
            var modelVersion = model.Version;
            var settings = options.CurrentValue;

            var nodes = BuildNodes(model);
            var objectives = model.Notas
                .Where(n => n.Tipo == SeasonObjectiveTipo && !string.IsNullOrWhiteSpace(n.Texto))
                .Select(n => n.Texto.Trim())
                .ToList();
            var sessions = await LoadSessionsAsync(teamId, settings.SessionWindowDays, ct);
            var players = await LoadPlayersAsync(teamId, settings.SessionWindowDays, ct);
            var forecast = await LoadForecastAsync(teamId, ct);

            var text = Format(model, nodes, objectives, sessions, players, forecast, settings.SessionWindowDays, null);
            if (text.Length > Math.Min(settings.FullDetailCharacters, settings.MaxContextCharacters))
            {
                var focused = SelectFocusedBranches(nodes, focusTexts);
                text = Format(model, nodes, objectives, sessions, players, forecast, settings.SessionWindowDays, focused);
            }

            if (text.Length > settings.MaxContextCharacters)
            {
                throw new DomainException("Asistente de IA", "El contexto del modelo supera el tamaño máximo permitido.",
                    ErrorCodes.GameModelAssistantContextTooLarge);
            }

            return new AssistantContext(text, modelVersion);
        }

        /// <summary>
        /// Node addresses come from <see cref="GameModelNodeAddresses"/>, the single addressing scheme; each
        /// node's text is looked up from its entity (by key, or by the id after the address marker).
        /// </summary>
        private static IReadOnlyList<AssistantNodeContext> BuildNodes(GameModel model)
        {
            var subprincipios = model.Principles.SelectMany(p => p.Subprincipios).ToList();
            var zonas = subprincipios.SelectMany(s => s.Zonas).ToList();
            var subSubPrincipios = subprincipios.SelectMany(s => s.SubSubPrincipios)
                .Concat(zonas.SelectMany(z => z.SubSubPrincipios))
                .ToList();

            var principlesByKey = Index(model.Principles, p => p.Key);
            var subprincipiosByKey = Index(subprincipios, s => s.Key);
            var zonasByKey = Index(zonas, z => z.Key);
            var subSubPrincipiosByKey = Index(subSubPrincipios, s => s.Key);
            var habilidadesById = Index(subSubPrincipios.SelectMany(s => s.Habilidades), h => h.Id);
            var notasById = Index(model.Notas, n => n.Id);
            var setPiecesById = Index(model.SetPieceRules, r => r.Id);

            var addresses = GameModelNodeAddresses.List(model);
            var byAddress = new Dictionary<string, NodeAddress>();
            foreach (var address in addresses)
                byAddress.TryAdd(address.Address, address);

            var nodes = new List<AssistantNodeContext>();
            foreach (var node in addresses)
            {
                var described = node.NodeType switch
                {
                    AssistantNodeType.Principio => Describe(principlesByKey, node.Address, p => Join(p.Titulo, p.Texto), p => Join(p.Titulo)),
                    AssistantNodeType.Subprincipio => Describe(subprincipiosByKey, node.Address, s => Join(s.Titulo, s.Texto), s => Join(s.Titulo)),
                    AssistantNodeType.Zona => Describe(zonasByKey, node.Address,
                        z => Join(z.ZoneKeysCsv, z.Label, z.ZonaTexto, z.Texto),
                        z => string.IsNullOrWhiteSpace(z.Label) ? Join(z.ZoneKeysCsv) : Join(z.Label)),
                    AssistantNodeType.SubSubPrincipio => Describe(subSubPrincipiosByKey, node.Address, s => Join(s.Rol, s.Texto), s => Join(s.Rol)),
                    AssistantNodeType.Habilidad => Describe(habilidadesById, IdAfter(node.Address, "/hab:"),
                        h => Join(h.Nombre, h.Descripcion, h.Entrenable), h => Join(h.Nombre)),
                    AssistantNodeType.Nota => Describe(notasById, IdAfter(node.Address, "/nota:"), n => Join(n.Tipo, n.Texto), n => Join(n.Tipo)),
                    AssistantNodeType.SetPieceRule => Describe(setPiecesById, IdAfter(node.Address, "set-pieces/"),
                        r => Join(r.Subtype, r.Texto), r => Join(r.Subtype)),
                    _ => null
                };

                if (described is { } found)
                    nodes.Add(new AssistantNodeContext(node.Address, node.NodeType, found.Text, found.Title, BranchOf(node, byAddress)));
            }

            return nodes;
        }

        /// <summary>The top-level ancestor of a node: its principle key, or "set-pieces" for a set-piece rule.</summary>
        private static string BranchOf(NodeAddress node, IReadOnlyDictionary<string, NodeAddress> byAddress)
        {
            var current = node;
            while (current.ParentAddress is { } parent && byAddress.TryGetValue(parent, out var up))
                current = up;
            return current.ParentAddress ?? current.Address;
        }

        /// <summary>
        /// Picks the branches whose titles (or addresses) the conversation names. Each focus text is tried in order and the
        /// first one that names a branch wins; a branch is kept when its score is at least half of the best branch's.
        /// An empty set means no branch was named.
        /// </summary>
        private static HashSet<string> SelectFocusedBranches(IReadOnlyList<AssistantNodeContext> nodes, IReadOnlyList<string>? focusTexts)
        {
            foreach (var focusText in focusTexts ?? Array.Empty<string>())
            {
                if (string.IsNullOrWhiteSpace(focusText))
                    continue;

                var focusNormalized = Normalize(focusText);
                var focusTokens = Tokens(focusNormalized);
                var scores = new Dictionary<string, int>();

                foreach (var node in nodes)
                {
                    var score = ScoreNode(node, focusNormalized, focusTokens);
                    if (score > 0)
                        scores[node.BranchKey] = scores.GetValueOrDefault(node.BranchKey) + score;
                }

                if (scores.Count == 0)
                    continue;

                var threshold = Math.Max(1, (scores.Values.Max() + 1) / 2);
                return scores.Where(s => s.Value >= threshold).Select(s => s.Key).ToHashSet(StringComparer.Ordinal);
            }

            return new HashSet<string>(StringComparer.Ordinal);
        }

        private const int NamedNodeScore = 10;
        private const int MinTitleLength = 4;

        private static int ScoreNode(AssistantNodeContext node, string focusNormalized, HashSet<string> focusTokens)
        {
            if (focusNormalized.Contains(node.Address.ToLowerInvariant(), StringComparison.Ordinal))
                return NamedNodeScore;

            var title = Normalize(node.Title);
            if (title.Length < MinTitleLength)
                return 0;

            return focusNormalized.Contains(title, StringComparison.Ordinal)
                ? NamedNodeScore
                : Tokens(title).Count(focusTokens.Contains);
        }

        private static readonly HashSet<string> GenericWords = new(StringComparer.Ordinal)
        {
            "principio", "principios", "subprincipio", "subprincipios", "modelo", "juego", "zona", "zonas", "nota", "notas",
            "habilidad", "habilidades", "cambia", "cambiar", "modifica", "modificar", "anade", "anadir", "quita", "quitar",
            "elimina", "eliminar", "crea", "crear", "mejora", "mejorar", "otro", "otra", "otros", "otras", "nuevo", "nueva",
            "para", "como", "pero", "sino", "este", "esta", "esto", "todo", "toda", "todos", "todas", "sobre", "entre",
            "desde", "hasta", "donde", "cuando", "quiero", "puedes", "debe", "deben", "sean", "haya", "aunque", "tiene",
            "tienen", "generico", "generica", "hacer", "mejor", "dividir"
        };

        private static string Normalize(string value)
        {
            var decomposed = value.Normalize(NormalizationForm.FormD);
            var result = new StringBuilder(decomposed.Length);
            foreach (var c in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    result.Append(char.ToLowerInvariant(c));
            }

            return result.ToString().Normalize(NormalizationForm.FormC);
        }

        private static HashSet<string> Tokens(string normalized) =>
            Regex.Split(normalized, "[^a-z0-9]+")
                .Where(t => t.Length >= MinTitleLength && !GenericWords.Contains(t))
                .ToHashSet(StringComparer.Ordinal);

        private async Task<IReadOnlyList<AssistantSessionContext>> LoadSessionsAsync(string teamId, int windowDays, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var sessions = await db.TrainingSessions
                .AsNoTracking()
                .Where(s => s.TeamId == teamId && s.Date >= now.AddDays(-windowDays) && s.Date <= now.AddDays(windowDays)
                            && s.ObjetivoGeneral != null)
                .OrderBy(s => s.Date)
                .Select(s => new { s.Date, s.ObjetivoGeneral })
                .ToListAsync(ct);

            return sessions
                .Where(s => s.Date is not null && !string.IsNullOrWhiteSpace(s.ObjetivoGeneral))
                .Select(s => new AssistantSessionContext(DateOnly.FromDateTime(s.Date!.Value), s.ObjetivoGeneral!.Trim()))
                .ToList();
        }

        private async Task<IReadOnlyList<AssistantPlayerContext>> LoadPlayersAsync(string teamId, int windowDays, CancellationToken ct)
        {
            var active = await conditions.GetForTeamAsync(teamId, ct);
            if (active.Count == 0)
                return Array.Empty<AssistantPlayerContext>();

            var teamPlayerIds = active.Select(c => c.TeamPlayerId).ToList();
            var aliasByPlayer = (await db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => teamPlayerIds.Contains(tp.Id))
                    .Select(tp => new { tp.Id, tp.Player.Alias })
                    .ToListAsync(ct))
                .ToDictionary(x => x.Id, x => x.Alias);

            // Projected fields only: the injury description is never selected. Open injuries and injuries that ended
            // inside the sessions' window are sent; an injury that ended before the window is left out.
            var injuryCutoff = DateTime.UtcNow.Date.AddDays(-windowDays);
            var injuriesByPlayer = (await db.TeamPlayerInjuries
                    .AsNoTracking()
                    .Where(i => teamPlayerIds.Contains(i.TeamPlayerId) && (i.EndDate == null || i.EndDate >= injuryCutoff))
                    .Select(i => new { i.TeamPlayerId, i.InjuryType, i.StartDate, i.EndDate, i.EstimatedRecovery })
                    .ToListAsync(ct))
                .GroupBy(i => i.TeamPlayerId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<AssistantInjuryContext>)g
                        .OrderByDescending(i => i.StartDate)
                        .Select(i => new AssistantInjuryContext(
                            i.InjuryType,
                            DateOnly.FromDateTime(i.StartDate),
                            i.EndDate.HasValue ? DateOnly.FromDateTime(i.EndDate.Value) : (DateOnly?)null,
                            i.EstimatedRecovery))
                        .ToList());

            // Players are visited in team-player-id order, so the "Jugador N" labels do not move between turns.
            var players = new List<AssistantPlayerContext>(active.Count);
            var unnamedCount = 0;
            foreach (var condition in active.OrderBy(c => c.TeamPlayerId, StringComparer.Ordinal))
            {
                // Alias only: the neutral label stands in when a player has none.
                var alias = aliasByPlayer.TryGetValue(condition.TeamPlayerId, out var storedAlias)
                    ? (storedAlias ?? string.Empty).Trim()
                    : string.Empty;
                if (alias.Length == 0)
                    alias = $"Jugador {++unnamedCount}";
                var injuries = injuriesByPlayer.TryGetValue(condition.TeamPlayerId, out var found)
                    ? found
                    : Array.Empty<AssistantInjuryContext>();

                players.Add(new AssistantPlayerContext(alias, injuries, condition.Fatigue, condition.Readiness, condition.FormStatus));
            }

            return players;
        }

        private async Task<OwnTeamForecast?> LoadForecastAsync(string teamId, CancellationToken ct)
        {
            // Teams without a federation league have no calendar to forecast, so the section is left out
            // without going through the league resolver's conflict error.
            var hasLeague = await db.Teams
                .AsNoTracking()
                .AnyAsync(t => t.Id == teamId && t.RffmCompetitionId != null && t.RffmGroupId != null, ct);
            return hasLeague ? await forecasts.GetAsync(teamId, ct) : null;
        }

        private static string Format(GameModel model, IReadOnlyList<AssistantNodeContext> nodes, IReadOnlyList<string> objectives,
            IReadOnlyList<AssistantSessionContext> sessions, IReadOnlyList<AssistantPlayerContext> players,
            OwnTeamForecast? forecast, int windowDays, HashSet<string>? detailedBranches)
        {
            var text = new StringBuilder();
            text.AppendLine($"Modelo de juego: {model.Name} ({model.Season})");

            text.AppendLine();
            text.AppendLine("Nodos del modelo:");
            var omitted = 0;
            foreach (var node in nodes)
            {
                var detailed = detailedBranches is null || detailedBranches.Contains(node.BranchKey);
                if (!detailed && !IsStructural(node.NodeType))
                {
                    omitted++;
                    continue;
                }

                var line = detailed ? node.Text : node.Title;
                text.Append($"- [{node.Address}] {NodeLabel(node.NodeType)}");
                if (line.Length > 0)
                    text.Append($": {line}");
                text.AppendLine();
            }

            if (detailedBranches is not null)
                text.AppendLine(DetailNotice(nodes, detailedBranches, omitted));

            text.AppendLine();
            text.AppendLine("Objetivos de temporada:");
            AppendLines(text, objectives, "(sin objetivos)");

            text.AppendLine();
            text.AppendLine($"Sesiones de entrenamiento (±{windowDays.ToString(CultureInfo.InvariantCulture)} días):");
            if (sessions.Count == 0)
                text.AppendLine("(sin sesiones con objetivo)");
            foreach (var session in sessions)
                text.AppendLine($"- {FormatDate(session.Date)}: {session.GeneralObjective}");

            text.AppendLine();
            text.AppendLine("Jugadores activos:");
            if (players.Count == 0)
                text.AppendLine("(sin jugadores)");
            foreach (var player in players)
            {
                text.AppendLine($"- {player.Alias}: Cansancio {FormatNumber(player.Fatigue)}/100, " +
                                $"Rodaje {FormatNumber(player.Readiness)}/100, Estado de forma {FormatNumber(player.FormStatus)}/100");
                foreach (var injury in player.Injuries)
                {
                    text.AppendLine($"  Lesión: {injury.InjuryType}, inicio {FormatDate(injury.StartDate)}, " +
                                    $"fin {FormatDate(injury.EndDate, "en curso")}, recuperación estimada: {injury.EstimatedRecovery ?? "sin dato"}");
                }
            }

            if (forecast is not null)
            {
                text.AppendLine();
                text.AppendLine("Previsión de la liga:");
                if (forecast.PendingMatches.Count == 0)
                    text.AppendLine("- (sin partidos pendientes)");
                foreach (var match in forecast.PendingMatches)
                {
                    text.AppendLine($"- {FormatDate(match.Date, "sin fecha")} vs {match.Opponent}: " +
                                    $"victoria local {FormatPercent(match.HomeWinProbability)}, empate {FormatPercent(match.DrawProbability)}, " +
                                    $"victoria visitante {FormatPercent(match.AwayWinProbability)}");
                }
                text.AppendLine($"Posición proyectada: {FormatNumber(forecast.ProjectedPosition)}");
            }

            return text.ToString();
        }

        private static bool IsStructural(AssistantNodeType nodeType) =>
            nodeType is AssistantNodeType.Principio or AssistantNodeType.Subprincipio
                or AssistantNodeType.Zona or AssistantNodeType.SubSubPrincipio;

        private static string DetailNotice(IReadOnlyList<AssistantNodeContext> nodes, HashSet<string> detailedBranches, int omitted)
        {
            if (detailedBranches.Count == 0)
            {
                return "(No se ha identificado ninguna rama concreta del modelo: solo se muestran los títulos " +
                       $"y se omiten {omitted.ToString(CultureInfo.InvariantCulture)} habilidades, notas y reglas. " +
                       "Pide al entrenador que indique el principio o subprincipio que quiere cambiar.)";
            }

            var branches = nodes
                .Where(n => detailedBranches.Contains(n.BranchKey) && n.Address == n.BranchKey)
                .Select(n => n.Address)
                .ToList();
            var named = branches.Count > 0 ? string.Join(", ", branches) : string.Join(", ", detailedBranches.OrderBy(b => b, StringComparer.Ordinal));
            return $"(Detalle completo solo de: {named}. En las demás ramas solo se muestran los títulos y se omiten " +
                   $"{omitted.ToString(CultureInfo.InvariantCulture)} habilidades, notas y reglas. " +
                   "Si el entrenador pide cambiar otra rama, pídele que la nombre.)";
        }

        private static void AppendLines(StringBuilder text, IReadOnlyList<string> lines, string whenEmpty)
        {
            if (lines.Count == 0)
                text.AppendLine(whenEmpty);
            foreach (var line in lines)
                text.AppendLine($"- {line}");
        }

        private static string NodeLabel(AssistantNodeType nodeType) => nodeType switch
        {
            AssistantNodeType.Principio => "Principio",
            AssistantNodeType.Subprincipio => "Subprincipio",
            AssistantNodeType.Zona => "Zona",
            AssistantNodeType.SubSubPrincipio => "Sub-subprincipio",
            AssistantNodeType.Habilidad => "Habilidad",
            AssistantNodeType.Nota => "Nota",
            AssistantNodeType.SetPieceRule => "Balón parado",
            _ => nodeType.ToString()
        };

        private static string FormatDate(DateOnly? date, string whenNull = "sin fecha") =>
            date is { } value ? value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : whenNull;

        private static string FormatNumber(int? value) =>
            value is { } number ? number.ToString(CultureInfo.InvariantCulture) : "sin datos";

        private static string FormatPercent(double probability) =>
            (probability * 100).ToString("0.0", CultureInfo.InvariantCulture) + "%";

        private static string Join(params string?[] parts) => string.Join(" | ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));

        private static (string Text, string Title)? Describe<T>(IReadOnlyDictionary<string, T> items, string id,
            Func<T, string> describe, Func<T, string> title) =>
            items.TryGetValue(id, out var item) ? (describe(item), title(item)) : null;

        private static string IdAfter(string address, string marker)
        {
            var start = address.LastIndexOf(marker, StringComparison.Ordinal);
            return start < 0 ? string.Empty : address[(start + marker.Length)..];
        }

        /// <summary>First entity wins when two share a key, so a duplicate never throws.</summary>
        private static Dictionary<string, T> Index<T>(IEnumerable<T> items, Func<T, string> key)
        {
            var index = new Dictionary<string, T>();
            foreach (var item in items)
                index.TryAdd(key(item), item);
            return index;
        }
    }
}
