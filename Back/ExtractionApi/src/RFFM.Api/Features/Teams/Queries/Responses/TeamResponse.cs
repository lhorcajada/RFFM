using RFFM.Api.Features.Teams.Models;
using System.Text.Json.Serialization;
using RFFM.Api.Features.Players.Models;

namespace RFFM.Api.Features.Teams.Queries.Responses
{
    public class Team
    {
        public string Status { get; set; } = string.Empty;

         public string SessionOk { get; set; } = string.Empty;

        public string TeamCode { get; set; } = string.Empty;

        public string ClubCode { get; set; } = string.Empty;

        public string AccessKey { get; set; } = string.Empty;

        public string TeamName { get; set; } = string.Empty;

        public string ClubShield { get; set; } = string.Empty;

        public string ClubName { get; set; } = string.Empty;

        public string Category { get; set; } = string.Empty;

        public string CategoryCode { get; set; } = string.Empty;

        public string Website { get; set; } = string.Empty;

        public string FieldCode { get; set; } = string.Empty;

        public string Field { get; set; } = string.Empty;

        public string FieldPhoto { get; set; } = string.Empty;

        public string TrainingField { get; set; } = string.Empty;

        public string CorrespondenceHolder { get; set; } = string.Empty;

        public string CorrespondenceTitle { get; set; } = string.Empty;

        public string CorrespondenceAddress { get; set; } = string.Empty;

        public string CorrespondenceCity { get; set; } = string.Empty;

        public string CorrespondenceProvince { get; set; } = string.Empty;

        public string CorrespondencePostalCode { get; set; } = string.Empty;

        public string CorrespondenceEmail { get; set; } = string.Empty;

        public string Phones { get; set; } = string.Empty;

        public string PlayDay { get; set; } = string.Empty;

        public string PlaySchedule { get; set; } = string.Empty;

        public string Fax { get; set; } = string.Empty;

        public List<TeamDelegate> Delegates { get; set; } = new();

        public List<TeamAssistant> Assistants { get; set; } = new();

        public List<TeamCoach> Coaches { get; set; } = new();

        public List<Player> Players { get; set; } = new();
    }

    public class TeamDelegate
    {
        public string DelegateCode { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
    }

    public class TeamAssistant
    {
        public string AssistantCode { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
    }

    public class TeamCoach
    {
        public string CoachCode { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
    }

}
