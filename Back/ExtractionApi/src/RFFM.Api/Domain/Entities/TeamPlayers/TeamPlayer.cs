using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Players;
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

        public Team Team { get; set; } = null!;
        public Player Player { get; set; } = null!;


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
        }
        
        public static TeamPlayer Create(TeamPlayerModel teamPlayerModel)
        {
            return new TeamPlayer(teamPlayerModel);
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
            if (joinedDate > DateTime.UtcNow)
                throw new ArgumentException("La fecha de unión no puede ser posterior a la fecha actual");
            JoinedDate = joinedDate;
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
            // if no family members provided, initialize to empty list
            if (familyMembers == null || familyMembers.Count == 0)
            {
                FamilyMembers = new List<Family>();
                return;
            }

            var list = new List<Family>();
            foreach (var fm in familyMembers)
            {
                var address = new Address
                {
                    Street = fm.Address?.Street,
                    City = fm.Address?.City,
                    Country = fm.Address?.Country,
                    PostalCode = fm.Address?.PostalCode,
                    Province = fm.Address?.Province
                };

                var familyMember = FamilyMember.FromId(fm.FamilyMemberId ?? 0);
                list.Add(new Family(address, fm.Phone, fm.Email, fm.Name, familyMember?.Name));
            }

            FamilyMembers = list;
        }
    }

}
