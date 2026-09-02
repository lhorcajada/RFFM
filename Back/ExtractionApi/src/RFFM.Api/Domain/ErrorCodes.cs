namespace RFFM.Api.Domain
{
    /// <summary>
    /// Central catalog of `code` values exposed in <c>ProblemDetails.Extensions["code"]</c> for
    /// status 400 responses. This is the single source of truth for error codes: every
    /// <see cref="DomainException"/> call site (and the built-in exception mappings in
    /// <c>ServiceCollectionExtensions.AddCustomProblemDetails()</c>) must reference a constant from
    /// this class instead of a literal string, so the frontend i18n dictionary (see
    /// openspec change `unified-error-codes-i18n`) can rely on a stable, typo-free list.
    /// </summary>
    public static class ErrorCodes
    {
        // Generic / pipeline (ValidationBehavior, ArgumentNullException guards)
        public const string ValidationFailed = "ValidationFailed";
        public const string MissingRequiredArgument = "MissingRequiredArgument";

        // Users / Register (Features/Coaches/Users/Commands/CreateUser.cs, POST /api/register)
        public const string EmailIsAlreadyTaken = "EmailIsAlreadyTaken";
        public const string AliasIsAlreadyTaken = "AliasIsAlreadyTaken";
        public const string AccountTypeRequired = "AccountTypeRequired";
        public const string UserCreationFailed = "UserCreationFailed";

        // Role-based registration (Features/Coaches/Users/Commands/CreateUser.cs, api/register;
        // Features/Coaches/Invitation/...; Features/Coaches/ClubJoinRequests/...)
        public const string TrialAcceptanceRequired = "TrialAcceptanceRequired";
        public const string ClubInvitationCodeRequired = "ClubInvitationCodeRequired";
        public const string ClubInvitationCodeInvalid = "ClubInvitationCodeInvalid";
        public const string ClubInvitationCodeNotAllowedForRole = "ClubInvitationCodeNotAllowedForRole";
        public const string TeamInvitationCodeRequired = "TeamInvitationCodeRequired";
        public const string TeamInvitationCodeInvalid = "TeamInvitationCodeInvalid";
        public const string TeamInvitationCodeNotAllowedForRole = "TeamInvitationCodeNotAllowedForRole";
        public const string LinkedPlayerRequired = "LinkedPlayerRequired";
        public const string LinkedPlayerAlreadyClaimed = "LinkedPlayerAlreadyClaimed";
        public const string PlayerLinkCodeInvalid = "PlayerLinkCodeInvalid";
        // TeamPlayerLinkRequestAlreadyDecided is retained: still used by the kept domain entity
        // Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs (EnsurePending) even though the
        // manual-approval feature (Approve/Reject/GetTeamPlayerLinkRequests) that used to be its
        // only other consumer was removed by openspec change simplify-player-family-registration.
        public const string TeamPlayerLinkRequestAlreadyDecided = "TeamPlayerLinkRequestAlreadyDecided";
        public const string ClubJoinRequestNotFound = "ClubJoinRequestNotFound";
        public const string ClubJoinRequestAlreadyDecided = "ClubJoinRequestAlreadyDecided";
        public const string ClubJoinRequestCancelForbidden = "ClubJoinRequestCancelForbidden";

        // Auth / TokenService (login) -- most codes here are already-established via CodeMessages,
        // listed here only for documentation purposes (values come from ValidationMessages.resx):
        // LoginEmptyUserOrPass, LoginUserNotRegistered, LoginEmailNotConfirmed, LoginErrorUserOrPassword.
        // Value preserved from the pre-existing literal used in TokenService.cs (GenerateTokenForUser)
        public const string UserNotFound = "user_not_found";

        // Training Sessions (Features/Coaches/Trainings/Sessions)
        public const string SessionNotFound = "SessionNotFound";
        public const string SessionAccessDenied = "SessionAccessDenied";
        public const string TeamAccessDenied = "TeamAccessDenied";

        // Exercises (Features/Coaches/Trainings/Exercises)
        public const string ExerciseNotFound = "ExerciseNotFound";
        public const string ExerciseAccessDenied = "ExerciseAccessDenied";
        public const string ClubAccessDenied = "ClubAccessDenied";
        public const string ExerciseInUseBySession = "ExerciseInUseBySession";

        // Training Sessions (Features/Coaches/Trainings/Sessions) - Microciclo/plan association
        public const string MicrocicloTeamMismatch = "MicrocicloTeamMismatch";
        public const string MicrocicloNotFound = "MicrocicloNotFound";

        // Game Models (Features/Coaches/GameModels)
        public const string GameModelNotFound = "GameModelNotFound";
        public const string GameModelAccessDenied = "GameModelAccessDenied";
        public const string GameModelAlreadyExists = "GameModelAlreadyExists";
        public const string SubSubPrincipleAccessDenied = "SubSubPrincipleAccessDenied";
        public const string SkillNotFound = "SkillNotFound";
        public const string SkillAccessDenied = "SkillAccessDenied";
        public const string ScenarioNotFound = "ScenarioNotFound";

        // Teams (Features/Coaches/Teams)
        public const string TeamListAccessDenied = "TeamListAccessDenied";
        // Value preserved from the pre-existing RFFM.Api.Features.Coaches.Teams.TeamConstants.TeamHasPlayersCode
        public const string TeamHasPlayers = "team_has_players";

        // Seasons (Features/Coaches/Seasons)
        // Value preserved from the pre-existing literal used in GetActiveSeason.cs
        public const string NoActiveSeason = "NotActiveSeason";
        // Value preserved from the pre-existing RFFM.Api.Features.Coaches.Seasons.SeasonConstants.SeasonHasRelatedDataCode
        public const string SeasonHasRelatedData = "season_has_related_data";

        // Players / Clubs (Features/Coaches/Players/Services/PlayerService.cs)
        // Value preserved from the pre-existing literal used in PlayerService.cs
        public const string ClubNotExist = "ClubNotExist";

        // Clubs (Features/Coaches/Clubs/Commands/CreateClub.cs)
        public const string ClubQuotaExceeded = "club_quota_exceeded";

        // News (Features/Coaches/News)
        public const string NewsNotFound = "NewsNotFound";
        public const string NewsAlreadyPublished = "NewsAlreadyPublished";
        public const string NewsNotPublished = "NewsNotPublished";

        // Push Notifications (Features/Mobile/PushNotifications)
        public const string PushTokenNotFound = "PushTokenNotFound";

        // Season Plans (Features/Coaches/SeasonPlans)
        public const string SeasonPlanNotFound = "SeasonPlanNotFound";
        public const string SeasonPlanAccessDenied = "SeasonPlanAccessDenied";
        public const string SeasonPlanAlreadyExists = "SeasonPlanAlreadyExists";

        // Players (Features/Coaches/Players/Commands/UpdateTeamPlayer.cs) - openspec change
        // player-self-edit-physical-family-contact: Player/FamilyMember callers may only edit
        // their own linked TeamPlayer.
        public const string TeamPlayerEditForbidden = "TeamPlayerEditForbidden";

        // Family members (Features/Coaches/Players/Commands/CreateFamilyMember.cs,
        // DeleteFamilyMember.cs) - openspec change player-family-members-crud.
        public const string TeamPlayerNotFound = "TeamPlayerNotFound";
        public const string FamilyMemberNotFound = "FamilyMemberNotFound";
        public const string FamilyMemberRelationUnknown = "FamilyMemberRelationUnknown";

        // Family member accounts (Features/Coaches/FamilyMemberAccounts)
        public const string FamilyMemberEmailRequired = "FamilyMemberEmailRequired";
        public const string FamilyMemberAccountAlreadyLinked = "FamilyMemberAccountAlreadyLinked";
        public const string FamilyMemberAccountRequestAlreadyPending = "FamilyMemberAccountRequestAlreadyPending";
        public const string FamilyMemberAccountRequestNotFound = "FamilyMemberAccountRequestNotFound";
        public const string FamilyMemberAccountRequestAlreadyDecided = "FamilyMemberAccountRequestAlreadyDecided";
    }
}
