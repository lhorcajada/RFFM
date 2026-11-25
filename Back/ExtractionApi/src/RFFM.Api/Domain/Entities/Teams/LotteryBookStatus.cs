namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Paso del ciclo de vida de un taco. Avanza de uno en uno en el orden de declaración.
    /// </summary>
    public enum LotteryBookStatus
    {
        Unassigned = 0,
        Assigned = 1,
        DeliveredToPlayer = 2,
        ReturnedToCoach = 3,
        DeliveredToClub = 4
    }
}
