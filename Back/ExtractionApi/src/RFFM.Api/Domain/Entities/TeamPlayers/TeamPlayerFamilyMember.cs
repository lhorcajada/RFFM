using RFFM.Api.Domain.ValueObjects;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>
    /// Individual family member/contact of a <see cref="TeamPlayer"/>. Promoted from the owned
    /// value object <see cref="Family"/> (openspec change player-family-members-crud) to a
    /// first-level entity with its own <c>Id</c>, mirroring <see cref="TeamPlayerSanction"/> /
    /// <see cref="TeamPlayerInjury"/>, so it can be created/deleted individually via
    /// POST/DELETE /api/catalog/teamplayer/{id}/family-members[/{familyMemberId}] instead of only
    /// through the bulk PUT (<see cref="TeamPlayer.SetFamily"/>).
    /// <see cref="FamilyMember"/> stores the relationship name (e.g. "Mother") resolved from
    /// <see cref="RFFM.Api.Domain.ValueObjects.FamilyMember"/>, matching the column already used
    /// by the pre-existing "TeamPlayerFamilies" table.
    /// </summary>
    public class TeamPlayerFamilyMember : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public string? Name { get; private set; }
        public string? LastName { get; private set; }
        public string? Phone { get; private set; }
        public string? Email { get; private set; }
        public string? Dni { get; private set; }
        public string? FamilyMember { get; private set; }
        public Address? Address { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerFamilyMember() { }

        public static TeamPlayerFamilyMember Create(
            string teamPlayerId, string? name, string? lastName, string? phone,
            string? email, string? dni, string? familyMember, Address? address = null)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");

            return new TeamPlayerFamilyMember
            {
                TeamPlayerId = teamPlayerId,
                Name = name,
                LastName = lastName,
                Phone = phone,
                Email = email,
                Dni = dni,
                FamilyMember = familyMember,
                Address = address
            };
        }

        /// <summary>
        /// Updates this instance's values in place instead of being replaced by a new one, used
        /// by <see cref="TeamPlayer.SetFamily"/> when the incoming PUT array has the same size as
        /// the current one so unrelated data (e.g. this family member's own Id) doesn't churn.
        /// </summary>
        internal void UpdateDetails(
            string? name, string? lastName, string? phone, string? email,
            string? dni, string? familyMember, Address? address)
        {
            Name = name;
            LastName = lastName;
            Phone = phone;
            Email = email;
            Dni = dni;
            FamilyMember = familyMember;
            Address = address;
        }
    }
}
