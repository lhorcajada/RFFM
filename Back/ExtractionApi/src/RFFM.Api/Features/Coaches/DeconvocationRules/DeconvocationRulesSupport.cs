using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationRules
{
    /// <summary>Regla de la propuesta de desconvocatoria: condición del catálogo, texto, puntos y pesos.</summary>
    public record DeconvocationRuleDto(
        string Condition, string Text, Dictionary<string, double> Points, Dictionary<string, double> Weights);

    /// <summary>Reglas del equipo; <c>Rules</c> es null cuando se aplica la configuración por defecto.</summary>
    public record DeconvocationRulesDto(IReadOnlyList<DeconvocationRuleDto>? Rules, bool IsDefault);

    public static class DeconvocationRulesConstants
    {
        public const string BaseRoute = "/api/teams/{teamId}/deconvocation-rules";
        public const string Tag = "DeconvocationRules";
        public const int MaxRules = 20;
        public const int MaxTextLength = 200;
        public const double MaxValue = 1000;

        /// <summary>Catálogo de condiciones; debe coincidir con el del frontend (ruleCatalog.ts).</summary>
        public static readonly IReadOnlySet<string> Conditions = new HashSet<string>
        {
            "goals", "streak", "minimum", "rivalResult", "injured", "weeklyTraining",
            "recentRecovery", "recentDeconvocation", "technicalTotal", "rating", "necessity", "weeklyTrainingAccum",
        };
    }

    internal static class DeconvocationRulesSupport
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public static async Task RequireCoachAsync(
            AppDbContext db, ICurrentUserService currentUser, string teamId, CancellationToken ct)
        {
            if (!currentUser.IsAuthenticated || string.IsNullOrEmpty(currentUser.UserId))
                throw new UnauthorizedAccessException("No autenticado.");

            if (!await QuinielaSupport.IsCoachAsync(db, currentUser.UserId, teamId, ct))
                throw new ForbiddenAccessException("No tienes permiso para configurar las reglas de desconvocatoria del equipo.");
        }

        public static string Serialize(IEnumerable<DeconvocationRuleDto> rules) => JsonSerializer.Serialize(rules, Json);

        public static IReadOnlyList<DeconvocationRuleDto> Deserialize(string json) =>
            JsonSerializer.Deserialize<List<DeconvocationRuleDto>>(json, Json) ?? [];

        public static async Task<DeconvocationRulesDto> LoadAsync(AppDbContext db, string teamId, CancellationToken ct)
        {
            var json = await db.DeconvocationRulesSettings.AsNoTracking()
                .Where(s => s.TeamId == teamId)
                .Select(s => s.RulesJson)
                .SingleOrDefaultAsync(ct);
            return json is null ? new DeconvocationRulesDto(null, true) : new DeconvocationRulesDto(Deserialize(json), false);
        }
    }
}
