using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.ValueObjects;
using RFFM.Api.Domain.ValueObjects.Player;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayer : BaseEntity
    {
        public string TeamId { get; set; } = null!;
        public string PlayerId { get; set; } = null!;
        public DateTime JoinedDate { get; set; }
        public DateTime? LeftDate { get; set; }
        public PlayerContactInfo? ContactInfo { get; set; }
        public Dorsal? Dorsal { get; set; }
        public PhysicalAttributes? PhysicalInfo { get; set; }

        public List<Family> FamilyMembers { get; set; } = new();
        public Demarcation? Demarcation { get; set; } = null!;
        public ICollection<TeamPlayerInjury> Injuries { get; private set; } = new List<TeamPlayerInjury>();
        public ICollection<TeamPlayerSanction> Sanctions { get; private set; } = new List<TeamPlayerSanction>();

        public Team Team { get; set; } = null!;
        public Player Player { get; set; } = null!;
        public string SeasonId { get; set; } = null!;
        public Season Season { get; set; } = null!;
        public string? LinkCode { get; private set; }

        public int? Age { get; set; }
        public int? BirthYear { get; set; }
        public string? TeamName { get; set; } = null!;
        public string? TeamCategory { get; set; } = null!;

        private TeamPlayer() { }
        private TeamPlayer(TeamPlayerModel teamPlayerModel)
        {
            SetTeamId(teamPlayerModel.TeamId);
            SetPlayerId(teamPlayerModel.PlayerId);
            SetJoinedDate(teamPlayerModel.JoinedDate);
            SetLeftDate(teamPlayerModel.LeftDate);
            SetDemarcation(teamPlayerModel.Demarcation);
            SetContactInfo(teamPlayerModel.ContactInfo);
            SetDorsal(teamPlayerModel.Dorsal?.Number);
            SetPhysicalInfo(teamPlayerModel.Height, teamPlayerModel.Weight, teamPlayerModel.DominantFootId);
            SetFamily(teamPlayerModel.FamilyMembers);
            SetSeasonId(teamPlayerModel.SeasonId);
            SetAge(teamPlayerModel.Age);
            SetBirthYear(teamPlayerModel.BirthYear);
            SetTeamName(teamPlayerModel.TeamName);
            SetTeamCategory(teamPlayerModel.TeamCategory);
        }
        
        public static TeamPlayer Create(TeamPlayerModel teamPlayerModel)
        {
            return new TeamPlayer(teamPlayerModel);
        }

        public void SetSeasonId (string seasonId)
        {
            if (string.IsNullOrEmpty(seasonId))
                throw new ArgumentException("La temporada no puede estar vacía");
            SeasonId = seasonId;
        }

        public void SetAge(int? age)
        {
            Age = age;
        }

        public void SetTeamName(string? teamName)
        {
            TeamName = teamName;
        }

        public void SetTeamCategory(string? teamCategory)
        {
            TeamCategory = teamCategory;
        }
        public void SetBirthYear(int? birthYear)
        {
            SetAge(birthYear != null ? DateTime.UtcNow.Year - birthYear.Value : null);
        }

        public void SetDemarcation(DemarcationModel? demarcation)
        {
            if (demarcation == null)
                return;
            Demarcation = Demarcation.Create(demarcation);
        }

        public void SetJoinedDate(DateTime joinedDate)
        {
            if (joinedDate == default)
                throw new ArgumentException("La fecha de unión no puede estar vacía");
            var utc = DateTime.SpecifyKind(joinedDate, DateTimeKind.Utc);
            if (utc > DateTime.UtcNow)
                throw new ArgumentException("La fecha de unión no puede ser posterior a la fecha actual");
            JoinedDate = utc;
        }
        public void SetLeftDate(DateTime? leftDate)
        {
            if (leftDate != null && leftDate < JoinedDate)
                throw new ArgumentException("La fecha de baja no puede ser anterior a la fecha de unión");
            if (leftDate != null && leftDate > DateTime.UtcNow)
                throw new ArgumentException("La fecha de baja no puede ser posterior a la fecha actual");
            LeftDate = leftDate;
        }

        public void SetPlayerId(string playerId)
        {
            if (string.IsNullOrEmpty(playerId))
                throw new ArgumentException("El jugador no puede estar vacío");
            PlayerId = playerId;
        }
        public void SetTeamId(string teamId)
        {
            if (string.IsNullOrEmpty(teamId))
                throw new ArgumentException("El equipo no puede estar vacío");
            TeamId = teamId;
        }
        public void SetContactInfo(ContactModel? contactInfo)
        {
            var address = new Address
            {
                Street = contactInfo?.Address?.Street,
                City = contactInfo?.Address?.City,
                Country = contactInfo?.Address?.Country,
                PostalCode = contactInfo?.Address?.PostalCode,
                Province = contactInfo?.Address?.Province
            };
            ContactInfo = new PlayerContactInfo(address, contactInfo?.Phone, contactInfo?.Email);
        }
        public void SetDorsal(int? dorsal)
        {
            if (dorsal == null)
            {
                Dorsal = null;
                return;
            }
            Dorsal = new Dorsal(dorsal.Value);
        }
        public void SetPhysicalInfo(decimal? height, decimal? weight, int? dominantFootId)
        {
            var dominantFoot = dominantFootId != null ? PlayerFeet.PlayerFeet.GetById(dominantFootId.Value) : null;
            PhysicalInfo = new PhysicalAttributes(height, weight, dominantFoot);
        }
        public void SetFamily(List<FamilyModel>? familyMembers)
        {
            if (familyMembers == null || familyMembers.Count == 0)
            {
                FamilyMembers = new List<Family>();
                return;
            }

            // When the incoming list has the same size as the current one, update each existing
            // Family instance in place (by position) instead of replacing the collection. This
            // preserves the owned-entity identity EF Core already tracks (shadow "Id" key), which
            // a full replace with brand-new instances cannot do since those instances have no key
            // assigned yet. Only editing existing family members is supported here (no add/remove).
            var canUpdateInPlace = FamilyMembers.Count == familyMembers.Count;

            var list = canUpdateInPlace ? FamilyMembers : new List<Family>();
            for (var i = 0; i < familyMembers.Count; i++)
            {
                var fm = familyMembers[i];
                var address = new Address
                {
                    Street = fm.Address?.Street,
                    City = fm.Address?.City,
                    Country = fm.Address?.Country,
                    PostalCode = fm.Address?.PostalCode,
                    Province = fm.Address?.Province
                };

                var familyMember = FamilyMember.FromId(fm.FamilyMemberId ?? 0);

                if (canUpdateInPlace)
                {
                    list[i].UpdateDetails(address, fm.Phone, fm.Email, fm.Name, familyMember?.Name, fm.Dni);
                }
                else
                {
                    list.Add(new Family(address, fm.Phone, fm.Email, fm.Name, familyMember?.Name, fm.Dni));
                }
            }

            FamilyMembers = list;
        }

        public string GenerateLinkCode()
        {
            LinkCode = Guid.NewGuid().ToString("N")[..ValidationConstants.PlayerLinkCodeLength].ToUpperInvariant();
            return LinkCode;
        }

        public void UpdateContactEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return;
            var current = ContactInfo;
            // Copy the existing Address into a brand-new instance instead of reusing the
            // reference: Address is an owned type nested inside ContactInfo (itself owned in
            // its own table), and EF Core's change tracker identifies owned instances by
            // reference. Reusing the same Address reference under a new ContactInfo instance
            // (a different owner) loses track of it instead of persisting it under the new row.
            var address = current?.Address is null
                ? null
                : new Address
                {
                    Street = current.Address.Street,
                    City = current.Address.City,
                    Province = current.Address.Province,
                    PostalCode = current.Address.PostalCode,
                    Country = current.Address.Country
                };
            ContactInfo = new PlayerContactInfo(address, current?.Phone, email);
        }

        public bool AddFamilyMemberEmailIfMissing(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return false;
            var exists = FamilyMembers.Any(f => string.Equals(f.Email, email, StringComparison.OrdinalIgnoreCase));
            if (exists)
                return false;
            FamilyMembers.Add(new Family(address: null, phone: null, email: email, name: null, familyMember: null));
            return true;
        }
    }

}
