namespace RFFM.Api.Domain.Entities
{
    public class EventAttendanceConfirmation : BaseEntity
    {
        public string SportEventId { get; set; } = string.Empty;
        public string TeamPlayerId { get; set; } = string.Empty;
        public string ConfirmedByApplicationUserId { get; set; } = string.Empty;
        public int AttendanceStatusId { get; set; }
        public DateTime? RespondedAt { get; set; }

        private EventAttendanceConfirmation() { }

        public EventAttendanceConfirmation(string sportEventId, string teamPlayerId, string confirmedByApplicationUserId, int attendanceStatusId)
        {
            ValidateAndSet(sportEventId, teamPlayerId, confirmedByApplicationUserId, attendanceStatusId);
            RespondedAt = DateTime.UtcNow;
        }

        private void ValidateAndSet(string sportEventId, string teamPlayerId, string confirmedByApplicationUserId, int attendanceStatusId)
        {
            if (string.IsNullOrWhiteSpace(sportEventId))
                throw new DomainException("EventAttendanceConfirmation", "Sport event ID is required", ErrorCodes.ValidationFailed);

            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new DomainException("EventAttendanceConfirmation", "Team player ID is required", ErrorCodes.ValidationFailed);

            if (string.IsNullOrWhiteSpace(confirmedByApplicationUserId))
                throw new DomainException("EventAttendanceConfirmation", "Confirmed by user ID is required", ErrorCodes.ValidationFailed);

            // Validate attendance status
            try
            {
                AttendanceStatus.FromId(attendanceStatusId);
            }
            catch
            {
                throw new DomainException("EventAttendanceConfirmation", $"Invalid attendance status: {attendanceStatusId}", ErrorCodes.ValidationFailed);
            }

            SportEventId = sportEventId;
            TeamPlayerId = teamPlayerId;
            ConfirmedByApplicationUserId = confirmedByApplicationUserId;
            AttendanceStatusId = attendanceStatusId;
        }

        public void UpdateStatus(int newAttendanceStatusId)
        {
            try
            {
                AttendanceStatus.FromId(newAttendanceStatusId);
            }
            catch
            {
                throw new DomainException("EventAttendanceConfirmation", $"Invalid attendance status: {newAttendanceStatusId}", ErrorCodes.ValidationFailed);
            }

            AttendanceStatusId = newAttendanceStatusId;
            RespondedAt = DateTime.UtcNow;
        }
    }
}
