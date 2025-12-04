using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Players;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class Club : BaseEntity
    {
        public string Name { get; private set; }
        public int CountryId { get;  private set; }
        public string? ShieldUrl { get; private set; }
        public string? InvitationCode { get; private set; }

        public List<UserClub> UserClubs { get; set; } = null!;
        public List<Team> Teams { get; set; } = null!;
        public Country Country { get; set; }
        public List<Player> Players { get; set; } = null!;


        private Club()
        {
        }
        public Club(string name, int countryId, string? shieldUrl = "", string? invitationCode = null)
        {
            UpdateName(name);
            UpdateCountry(countryId);
            UpdateInvitationCode(invitationCode);
            UpdateShieldUrl(shieldUrl);

        }

        public void UpdateName(string name)
        {
            ValidationClub.ValidateName(name);
            Name = name;
        }
        public void UpdateShieldUrl(string? shieldUrl)
        {
            ValidationClub.ValidateShieldUrl(shieldUrl);
            ShieldUrl = shieldUrl;
        }

        public void UpdateCountry(int countryId)
        {
            ValidationClub.ValidateCountryId(countryId);
            CountryId = countryId;
        }
        public void UpdateInvitationCode(string? invitationCode)
        {
            if (string.IsNullOrWhiteSpace(invitationCode))
            {
                invitationCode = Guid.NewGuid().ToString("N")[..8].ToUpper();
            }

            InvitationCode = invitationCode;
        }
    }
}
