using Microsoft.AspNetCore.Http;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    public class CreatePlayerModel
    {
        public string Name { get; set; } = null!;
        public string? LastName { get; set; } = null!;
        public string Alias { get; set; } = null!;
        public IFormFile? PhotoFile { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Dni { get; set; }
        public string ClubId { get; set; } = null!;

    }
}
