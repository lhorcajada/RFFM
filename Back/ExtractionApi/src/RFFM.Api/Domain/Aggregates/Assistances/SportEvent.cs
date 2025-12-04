using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Models;

namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class SportEvent : BaseEntity
    {
        public string Name { get; set; } = null!;
        public DateTime EveDateTime { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public DateTime? ArrivalDate { get; set; }
        public string? Location { get; set; } = null!;
        public string? Description { get; set; } = null!;
        public int EventTypeId { get; set; }
        public string TeamId { get; set; } = null!;
        public string? RivalId { get; set; } = null!;

        public Team Team { get; set; } = null!;
        public Rival? Rival { get; set; } = null!;
        public SportEventType SportEventType { get; set; } = null!;

        public List<Convocation> Called { get; set; } = null!;

        private SportEvent()
        {
        }
        private SportEvent(EventModel createModel)
        {
            SetName(createModel.Name);
            SetEveDateTime(createModel.EveDateTime);
            SetStartTime(createModel.StartTime);
            SetEndTime(createModel.EndTime);
            SetArrivalDate(createModel.ArrivalDate);
            SetLocation(createModel.Location);
            SetDescription(createModel.Description);
            SetEventTypeId(createModel.EventTypeId);
            SetTeamId(createModel.TeamId);
            SetRivalId(createModel.RivalId);
        }

        public static SportEvent Create(EventModel createModel)
        {
            return new SportEvent(createModel);
        }

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ArgumentException("El nombre no puede estar vacío");
            if (name.Length > ValidationAssistancesConstants.MaxNameLength)
                throw new ArgumentException($"El nombre no puede tener más de {ValidationAssistancesConstants.MaxNameLength} caracteres");
            Name = name;
        }
        public void SetEveDateTime(DateTime eveDateTime)
        {
            if (eveDateTime == default)
                throw new ArgumentException("La fecha del evento no puede estar vacía");
            if (eveDateTime < DateTime.UtcNow)
                throw new ArgumentException("La fecha del evento no puede ser anterior a la fecha actual");

            EveDateTime = eveDateTime;
        }
        public void SetStartTime(DateTime startTime)
        {
            if (startTime == default)
                throw new ArgumentException("La hora de inicio no puede estar vacía");
            if (startTime < DateTime.UtcNow)
                throw new ArgumentException("La hora de inicio no puede ser anterior a la hora actual");
            if (EndTime != null && startTime >= EndTime)
                throw new ArgumentException("La hora de inicio no puede ser posterior o igual a la hora de fin");
            StartTime = startTime;
        }
        public void SetEndTime(DateTime? endTime)
        {
            if (endTime != null && endTime < DateTime.UtcNow)
                throw new ArgumentException("La hora de fin no puede ser anterior a la hora actual");
            if (StartTime != default && endTime <= StartTime)
                throw new ArgumentException("La hora de fin no puede ser anterior o igual a la hora de inicio");
            EndTime = endTime;
        }
        public void SetArrivalDate(DateTime arrivalDate)
        {
            if (arrivalDate < DateTime.UtcNow)
                throw new ArgumentException("La fecha de llegada no puede ser anterior a la fecha actual");
            if (arrivalDate > EndTime)
                throw new ArgumentException("La fecha de llegada no puede ser posterior a la fecha de fin del evento");
            ArrivalDate = arrivalDate;
        }
        public void SetLocation(string? location)
        {
            if (!string.IsNullOrEmpty(location) && location.Length > ValidationAssistancesConstants.MaxLocationLength)
                throw new ArgumentException($"La ubicación no puede tener más de {ValidationAssistancesConstants.MaxLocationLength} caracteres");
            Location = location;
        }

        public void SetDescription(string? description)
        {
            if (!string.IsNullOrEmpty(description) && description.Length > ValidationAssistancesConstants.MaxDescriptionLength)
                throw new ArgumentException($"La descripción no puede tener más de {ValidationAssistancesConstants.MaxDescriptionLength} caracteres");
            Description = description;
        }
        public void SetEventTypeId(int eventTypeId)
        {
            if (eventTypeId <= 0)
                throw new ArgumentException("El tipo de evento no es válido");
            SportEventType.ValidateEventType(eventTypeId);
            EventTypeId = eventTypeId;
        }
        public void SetTeamId(string teamId)
        {
            if (string.IsNullOrEmpty(teamId))
                throw new ArgumentException("El equipo no puede estar vacío");
            TeamId = teamId;
        }

        public void SetRivalId(string rivalId)
        {
            if (string.IsNullOrEmpty(rivalId))
                throw new ArgumentException("El rival no puede estar vacío");
            RivalId = rivalId;
        }
    }
}
