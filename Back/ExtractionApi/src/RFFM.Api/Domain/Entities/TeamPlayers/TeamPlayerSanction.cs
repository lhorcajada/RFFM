using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerSanction : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public SanctionCategory Category { get; private set; } = null!;
        public DateTime StartDate { get; private set; }
        public string SanctionType { get; private set; } = null!;
        public string? Description { get; private set; }
        public string? EstimatedEnd { get; private set; }
        public DateTime? EndDate { get; private set; }

        /// <summary>True when this sanction was created automatically by the system (5-yellow-card
        /// cycle or a red card in a league match), as opposed to created manually by the coach.</summary>
        public bool IsAutomatic { get; private set; }

        /// <summary>Optional fine amount associated with the sanction (editable by the coach even
        /// for automatic sanctions).</summary>
        public decimal? Fine { get; private set; }

        /// <summary>SportEvent.Id that triggered an automatic sanction. Null for manual sanctions.
        /// Used for idempotency: re-saving the same finished match must not duplicate the sanction.</summary>
        public string? SourceEventId { get; private set; }

        /// <summary>Optional sportive punishment attached to this sanction (Deconvocation or
        /// MinutesLimit); independent of the economic Fine/AmountPaid fields.</summary>
        public SanctionSportivePunishmentType? SportivePunishmentType { get; private set; }

        /// <summary>SportEvent.Id the sportive punishment applies to. Required iff
        /// SportivePunishmentType is set.</summary>
        public string? TargetEventId { get; private set; }

        /// <summary>Minute cap for a MinutesLimit sportive punishment. Required (and positive) iff
        /// SportivePunishmentType == MinutesLimit; must be null otherwise.</summary>
        public int? MinutesLimit { get; private set; }

        /// <summary>Amount already paid against Fine. Persisted; PendingAmount (Fine - AmountPaid)
        /// is computed at read time, never persisted.</summary>
        public decimal? AmountPaid { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;
        public SportEvent? TargetEvent { get; private set; }

        private TeamPlayerSanction() { }

        public static TeamPlayerSanction Create(
            string teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd, decimal? fine = null, decimal? amountPaid = null,
            SanctionSportivePunishmentType? sportivePunishmentType = null, string? targetEventId = null,
            int? minutesLimit = null)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");

            ValidateSportivePunishment(sportivePunishmentType, targetEventId, minutesLimit);
            ValidateAmountPaid(amountPaid);

            return new TeamPlayerSanction
            {
                TeamPlayerId = teamPlayerId,
                Category = category,
                StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
                SanctionType = sanctionType,
                Description = description,
                EstimatedEnd = estimatedEnd,
                EndDate = null,
                IsAutomatic = false,
                Fine = fine,
                SourceEventId = null,
                AmountPaid = amountPaid,
                SportivePunishmentType = sportivePunishmentType,
                TargetEventId = targetEventId,
                MinutesLimit = minutesLimit
            };
        }

        /// <summary>
        /// Creates a sanction generated automatically by the system when a player reaches their
        /// 5th cyclic yellow card or receives a red card in a league match ("Partido").
        /// </summary>
        public static TeamPlayerSanction CreateAutomatic(
            string teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType,
            string description, string sourceEventId)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");
            if (string.IsNullOrWhiteSpace(sourceEventId))
                throw new ArgumentException("El evento de origen es obligatorio para una sanción automática.");

            return new TeamPlayerSanction
            {
                TeamPlayerId = teamPlayerId,
                Category = category,
                StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
                SanctionType = sanctionType,
                Description = description,
                EstimatedEnd = null,
                EndDate = null,
                IsAutomatic = true,
                Fine = null,
                SourceEventId = sourceEventId
            };
        }

        public void Update(
            SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd, DateTime? endDate, decimal? fine = null,
            decimal? amountPaid = null, SanctionSportivePunishmentType? sportivePunishmentType = null,
            string? targetEventId = null, int? minutesLimit = null)
        {
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");

            ValidateSportivePunishment(sportivePunishmentType, targetEventId, minutesLimit);
            ValidateAmountPaid(amountPaid);

            Category = category;
            StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc);
            SanctionType = sanctionType;
            Description = description;
            EstimatedEnd = estimatedEnd;
            EndDate = endDate.HasValue
                ? (endDate.Value.Kind == DateTimeKind.Utc ? endDate.Value : DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc))
                : null;
            Fine = fine;
            AmountPaid = amountPaid;
            SportivePunishmentType = sportivePunishmentType;
            TargetEventId = targetEventId;
            MinutesLimit = minutesLimit;
        }

        /// <summary>Marks the sanction as served/fulfilled by setting EndDate. Narrow, symmetric
        /// with Reopen(); does not touch any other field.</summary>
        public void MarkFulfilled(DateTime at)
        {
            EndDate = at.Kind == DateTimeKind.Utc ? at : DateTime.SpecifyKind(at, DateTimeKind.Utc);
        }

        /// <summary>Reopens a fulfilled sanction back to Pending by clearing EndDate. Narrow,
        /// symmetric with MarkFulfilled(DateTime); does not touch any other field.</summary>
        public void Reopen()
        {
            EndDate = null;
        }

        private static void ValidateSportivePunishment(
            SanctionSportivePunishmentType? sportivePunishmentType, string? targetEventId, int? minutesLimit)
        {
            if (sportivePunishmentType == SanctionSportivePunishmentType.MinutesLimit)
            {
                if (string.IsNullOrWhiteSpace(targetEventId))
                    throw new ArgumentException("El evento objetivo es obligatorio para una sanción de límite de minutos.");
                if (minutesLimit is null || minutesLimit <= 0)
                    throw new ArgumentException("El límite de minutos debe ser un número positivo.");
            }
            else if (sportivePunishmentType == SanctionSportivePunishmentType.Deconvocation)
            {
                if (string.IsNullOrWhiteSpace(targetEventId))
                    throw new ArgumentException("El evento objetivo es obligatorio para una sanción de desconvocatoria.");
                if (minutesLimit is not null)
                    throw new ArgumentException("Una sanción de desconvocatoria no puede tener límite de minutos.");
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(targetEventId))
                    throw new ArgumentException("El evento objetivo solo aplica a sanciones deportivas (desconvocatoria o límite de minutos).");
                if (minutesLimit is not null)
                    throw new ArgumentException("El límite de minutos solo aplica a sanciones de tipo límite de minutos.");
            }
        }

        private static void ValidateAmountPaid(decimal? amountPaid)
        {
            if (amountPaid is not null && amountPaid < 0)
                throw new ArgumentException("El importe pagado no puede ser negativo.");
        }
    }
}
