namespace RFFM.Api.Domain.Aggregates.Assistances
{
    /// <summary>
    /// Pre-convocation availability check for a league match. Deliberately separate from
    /// <see cref="Convocation"/>: a player who is merely "available" must not count as convoked
    /// in statistics, load or minutes calculations, which all treat any Convocation row as one.
    /// </summary>
    public class AvailabilityRequest : BaseEntity
    {
        public string SportEventId { get; private set; } = null!;
        public string TeamPlayerId { get; private set; } = null!;
        public int StatusId { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? RespondedAt { get; private set; }

        public SportEvent SportEvent { get; private set; } = null!;

        private AvailabilityRequest() { }

        public static AvailabilityRequest Create(string sportEventId, string teamPlayerId, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(sportEventId))
                throw new ArgumentException("El evento no puede estar vacío", nameof(sportEventId));
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador no puede estar vacío", nameof(teamPlayerId));

            return new AvailabilityRequest
            {
                SportEventId = sportEventId,
                TeamPlayerId = teamPlayerId,
                StatusId = AvailabilityRequestStatus.Requested.Id,
                RequestedAt = now
            };
        }

        public bool IsRequested => StatusId == AvailabilityRequestStatus.Requested.Id;
        public bool IsAvailable => StatusId == AvailabilityRequestStatus.Available.Id;
        public bool IsUnavailable => StatusId == AvailabilityRequestStatus.Unavailable.Id;

        public void MarkAvailable(DateTime now)
        {
            if (IsUnavailable)
                throw InvalidTransition();
            StatusId = AvailabilityRequestStatus.Available.Id;
            RespondedAt = now;
        }

        public void MarkUnavailable(DateTime now)
        {
            if (IsUnavailable)
                throw InvalidTransition();
            StatusId = AvailabilityRequestStatus.Unavailable.Id;
            RespondedAt = now;
        }

        public void Reopen(DateTime now)
        {
            if (!IsUnavailable)
                throw InvalidTransition();
            StatusId = AvailabilityRequestStatus.Requested.Id;
            RequestedAt = now;
            RespondedAt = null;
        }

        private static DomainException InvalidTransition() =>
            new("Disponibilidad", "La petición de disponibilidad no admite este cambio.", ErrorCodes.AvailabilityInvalidTransition);
    }
}
