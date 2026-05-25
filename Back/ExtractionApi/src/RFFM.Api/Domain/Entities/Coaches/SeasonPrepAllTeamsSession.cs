using System;

namespace RFFM.Api.Domain.Entities.Coaches
{
    public class SeasonPrepAllTeamsSession
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string? SportEventId { get; set; }
        public string Data { get; set; } = "{}";
        public DateTime UpdatedAt { get; set; } = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
    }
}
