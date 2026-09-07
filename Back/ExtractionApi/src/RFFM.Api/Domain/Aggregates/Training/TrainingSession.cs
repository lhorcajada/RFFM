using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Aggregates.Training
{
    public class TrainingSession : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        /// <summary>Nullable since the `season-plan-content-board` change: a session may exist
        /// unscheduled ("content-first" planning), carrying only its <see cref="Targets"/>,
        /// before a Coach assigns it a date/time.</summary>
        public DateTime? Date { get; set; }
        public TimeSpan? StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        public string Location { get; set; } = string.Empty;
        public string? SportEventId { get; set; }
        public string TeamId { get; set; } = string.Empty;
        public string? UrlImage { get; set; }

        /// <summary>Optional, explicit association to a season-plan week. A Coach decides at
        /// creation/edit time whether the session belongs to a plan week or is independent.</summary>
        public string? MicrocicloId { get; set; }

        /// <summary>Free text, meaningful with or without a plan association.</summary>
        public string? ObjetivoGeneral { get; set; }

        /// <summary>Text placeholder/caption for the session's overall field-setup map ("Mapa
        /// de campo general") — the image itself, if any, uses <see cref="UrlImage"/>.</summary>
        public string? MapaCampoTexto { get; set; }

        public Team Team { get; set; } = null!;
        public SportEvent? SportEvent { get; set; }
        public List<SessionBlock> Blocks { get; set; } = new();

        /// <summary>Sub-subprincipio targets for content-first planning (season-plan-content-board
        /// change) — repetition across sessions is explicitly allowed, no uniqueness constraint.
        /// Built only via <see cref="ReplaceTargets"/>.</summary>
        public List<TrainingSessionSubSubPrincipio> Targets { get; set; } = new();

        /// <summary>Clears and rebuilds <see cref="Targets"/> wholesale — same "trust
        /// server-derived state" approach used across this codebase (e.g.
        /// <c>SessionBlock.ReplaceExercises</c>, <c>ExerciseModelRelation.ReplaceItems</c>).</summary>
        public void ReplaceTargets(IEnumerable<string>? subSubPrincipioIds)
        {
            Targets.Clear();
            foreach (var id in (subSubPrincipioIds ?? Enumerable.Empty<string>()).Distinct())
                Targets.Add(new TrainingSessionSubSubPrincipio(Id, id));
        }
    }
}
