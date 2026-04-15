namespace RFFM.Api.Domain.Entities.Coaches
{
    public class SeasonPrepSession
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = null!;
        public string Data { get; set; } = "{}";
        public DateTime UpdatedAt { get; set; } = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
    }
}
