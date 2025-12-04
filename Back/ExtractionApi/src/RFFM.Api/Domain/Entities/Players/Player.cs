using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;

namespace RFFM.Api.Domain.Entities.Players
{
    public class Player : BaseEntity, IAggregateRoot
    {
        public string Name { get; private set; }
        public string? LastName { get; private set; }
        public string? UrlPhoto { get; private set; }
        public string Alias { get; private set; } = null!;
        public DateTime? BirthDate { get; private set; }
        public string? Dni { get; private set; }
        public string ClubId { get; private set; }

        public Club Club { get; private set; } = null!;

        public Player() { }
        public static Player Create(PlayerModelBase modelBase)
        {
            return new Player(modelBase);
        }

        private Player(PlayerModelBase modelBase)
        {
           UpdateName(modelBase.Name);
           UpdateLastName(modelBase.LastName);
           UpdateUrlPhoto(modelBase.UrlPhoto);
           UpdateAlias(modelBase.Alias);
           UpdateBirthDate(modelBase.BirthDate);
           UpdateDni(modelBase.Dni);
           UpdateClubId(modelBase.ClubId);
        }

        public void UpdateName(string name)
        {
            ValidationPlayer.ValidateName(name);
            Name = name;
        }
        public void UpdateLastName(string? lastName)
        {
            ValidationPlayer.ValidateLastName(lastName);
            LastName = lastName;
        }
        public void UpdateUrlPhoto(string? urlPhoto)
        {
            ValidationPlayer.ValidateUrlPhoto(urlPhoto);
            UrlPhoto = urlPhoto;
        }
        public void UpdateAlias(string alias)
        {
            ValidationPlayer.ValidateAlias(alias);
            Alias = alias;
        }
        public void UpdateBirthDate(DateTime? birthDate)
        {
            ValidationPlayer.ValidateBirthDate(birthDate);
            BirthDate = birthDate;
        }
        public void UpdateDni(string? dni)
        {
            ValidationPlayer.ValidateDni(dni);
            Dni = dni;
        }
        public void UpdateClubId(string clubId)
        {
            ClubId = clubId;
        }

    }
}
