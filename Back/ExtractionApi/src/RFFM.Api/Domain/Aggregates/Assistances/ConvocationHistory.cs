using RFFM.Api.Domain.Models;

namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class ConvocationHistory: BaseEntity
    {
        public string ConvocationId { get; set; }
        public string UserId { get; set; }
        public DateTime ChangeDateTime { get; set; }
        public int? OldStatusId { get; set; }
        public int NewStatusId { get; set; }
        public Convocation Convocation { get; set; } = null!;

        private ConvocationHistory() { }
        public ConvocationHistory(ConvocationHistoryModel convocationHistoryModel)
        {
            SetChangeDateTime(convocationHistoryModel.ChangeDateTime);
            SetConvocationId(convocationHistoryModel.ConvocationId);
            SetNewStatusId(convocationHistoryModel.NewStatusId);
            SetOldStatusId(convocationHistoryModel.OldStatusId);
            SetUserId(convocationHistoryModel.UserId);
        }

        public static ConvocationHistory Create(ConvocationHistoryModel convocationHistoryModel)
        {
            return new ConvocationHistory(convocationHistoryModel);
        }

        public void SetConvocationId(string convocationId)
        {
            if (string.IsNullOrEmpty(convocationId))
                throw new ArgumentException("La convocatoria no puede estar vacía");
            ConvocationId = convocationId;
        }
        public void SetUserId(string userId)
        {
            if (string.IsNullOrEmpty(userId))
                throw new ArgumentException("El usuario no puede estar vacío");
            UserId = userId;
        }
        public void SetChangeDateTime(DateTime changeDateTime)
        {
            if (changeDateTime == default)
                throw new ArgumentException("La fecha de cambio no puede estar vacía");
            if (changeDateTime > DateTime.UtcNow)
                throw new ArgumentException("La fecha de cambio no puede ser posterior a la fecha actual");
            ChangeDateTime = changeDateTime;
        }
        public void SetOldStatusId(int oldStatusId)
        {
            if (oldStatusId < 0)
                throw new ArgumentException("El estado anterior no puede ser negativo");
            OldStatusId = oldStatusId;
        }
        public void SetNewStatusId(int newStatusId)
        {
            if (newStatusId <= 0)
                throw new ArgumentException("El nuevo estado no puede estar vacío");
            if(newStatusId < 0)
                throw new ArgumentException("El nuevo estado no puede ser negativo");
            NewStatusId = newStatusId;
        }



    }
}
