namespace RFFM.Api.Domain.Entities.Coaches
{
    public class SeasonPrepEvaluations
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = null!;
        public string FedSeason { get; set; } = null!;
        /// <summary>JSON array of evaluated players with their evaluation data.</summary>
        public string Data { get; set; } = "[]";
        public DateTime UpdatedAt { get; set; } = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
    }
}
