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

        // Exercise Conditions (Features/Coaches/Trainings/Exercises/ExerciseConditionsCrud.cs)
        public const string ExerciseConditionNotFound = "ExerciseConditionNotFound";
        public const string ExerciseConditionAccessDenied = "ExerciseConditionAccessDenied";

        // Game Models (Features/Coaches/GameModels)
        public const string GameModelNotFound = "GameModelNotFound";
        public const string GameModelAccessDenied = "GameModelAccessDenied";
        public const string GameModelAlreadyExists = "GameModelAlreadyExists";
        public const string SubSubPrincipleAccessDenied = "SubSubPrincipleAccessDenied";
        public const string SkillNotFound = "SkillNotFound";
        public const string SkillAccessDenied = "SkillAccessDenied";

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
    }
}
