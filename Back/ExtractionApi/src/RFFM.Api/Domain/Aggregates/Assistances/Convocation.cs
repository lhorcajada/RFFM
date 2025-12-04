using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;

namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class Convocation : BaseEntity
    {
        public string SportEventId { get; private set; } = null!;
        public string TeamPlayerId { get; private set; } = null!;
        public int AssistanceTypeId { get; private set; }
        public DateTime? ResponseDateTime { get; private set; }
        public int? ConvocationStatusId { get; private set; }
        public int? ExcuseTypeId { get; private set; }

        public AssistanceType Type { get; private set; } = null!;
        public ConvocationStatus? Status { get; private set; } = null!;
        public SportEvent SportEvent { get; private set; } = null!;
        public TeamPlayer Player { get; private set; } = null!;
        public ExcuseTypes? ExcuseType { get; private set; } = null!;

        private Convocation() { }
        public Convocation(ConvocationModel convocationModel)
        {
            SetAssistanceTypeId(convocationModel.AssistanceTypeId);
            SetConvocationStatusId(convocationModel.ConvocationStatusId);
            SetResponseDateTime(convocationModel.ResponseDateTime);
            SetEventId(convocationModel.EventId);
            SetTeamPlayerId(convocationModel.TeamPlayerId);
            SetExcuseTypeId(convocationModel.ExcuseTypeId);
        }

        public static Convocation Create(ConvocationModel convocationModel)
        {
            return new Convocation(convocationModel);
        }

        public void SetEventId(string eventId)
        {
            if (string.IsNullOrEmpty(eventId))
                throw new ArgumentException("El evento no puede estar vacío");
            SportEventId = eventId;
        }

        public void SetAssistanceTypeId(int assistanceTypeId)
        {
            if (assistanceTypeId <= 0)
                throw new ArgumentException("El tipo de asistencia no puede estar vacío");
            AssistanceTypeId = assistanceTypeId;
        }
        public void SetConvocationStatusId(int? convocationStatusId)
        {
            if (convocationStatusId!= null &&  convocationStatusId <= 0)
                throw new ArgumentException("El estado de la convocatoria no puede estar vacío");
            ConvocationStatusId = convocationStatusId;
        }
        public void SetResponseDateTime(DateTime? responseDateTime)
        {
            if (responseDateTime != null && responseDateTime > DateTime.UtcNow)
                throw new ArgumentException("La fecha de respuesta no puede ser posterior a la fecha actual");
            ResponseDateTime = responseDateTime;
        }

        public void SetTeamPlayerId(string teamPlayerId)
        {
            if (string.IsNullOrEmpty(teamPlayerId))
                throw new ArgumentException("El jugador no puede estar vacío");
            TeamPlayerId = teamPlayerId;
        }
        public void SetExcuseTypeId(int? excuseTypeId)
        {
            if (ExcuseTypeId != null && excuseTypeId < 0)
                throw new ArgumentException("El tipo de excusa no puede ser negativo");
            ExcuseTypeId = excuseTypeId;
        }
    }
}
