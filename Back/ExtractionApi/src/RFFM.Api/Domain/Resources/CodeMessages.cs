using Microsoft.Extensions.Localization;

namespace RFFM.Api.Domain.Resources
{
    public class ValidationMessageData
    {
        public string Code { get; set; } = null!;
        public string Message { get; set; } = null!;
    }
    public static class CodeMessages
    {
        private static IStringLocalizer _localizer;
        public static void Configure(IStringLocalizerFactory localizerFactory)
        {
            _localizer = localizerFactory.Create(typeof(ValidationMessages));
        }
        public static ValidationMessageData LoginEmptyUserOrPass => new()
        {
            Code = $"{nameof(LoginEmptyUserOrPass)}",
            Message = _localizer[nameof(LoginEmptyUserOrPass)]
        };

        public static ValidationMessageData LoginUserNotRegistered => new()
        {
            Code = $"{nameof(LoginUserNotRegistered)}",
            Message = _localizer[nameof(LoginUserNotRegistered)]
        };
        public static ValidationMessageData LoginErrorUserOrPassword => new()
        {
            Code = $"{nameof(LoginErrorUserOrPassword)}",
            Message = _localizer[nameof(LoginErrorUserOrPassword)]
        };

        public static ValidationMessageData LoginEmailNotConfirmed
        {
            get
            {
                var name = nameof(LoginEmailNotConfirmed);
                var localized = _localizer?[name];
                var message = localized is not null && !localized.ResourceNotFound
                    ? localized.Value
                    : "La cuenta está creada, pero todavía no ha sido confirmada por el administrador del sistema.";

                return new ValidationMessageData
                {
                    Code = name,
                    Message = message
                };
            }
        }

        public static ValidationMessageData RegisterEmailExistsAlready => new()
        {
            Code = $"{nameof(RegisterEmailExistsAlready)}",
            Message = _localizer[nameof(RegisterEmailExistsAlready)]
        };
        public static ValidationMessageData RegisterPassworNotMeetRequirements => new()
        {
            Code = $"{nameof(RegisterPassworNotMeetRequirements)}",
            Message = _localizer[nameof(RegisterPassworNotMeetRequirements)]
        };
        public static ValidationMessageData RegisterGeneralError => new()
        {
            Code = $"{nameof(RegisterGeneralError)}",
            Message = _localizer[nameof(RegisterGeneralError)]
        };
        public static ValidationMessageData RegisterFailedAssigningRole => new()
        {
            Code = $"{nameof(RegisterFailedAssigningRole)}",
            Message = _localizer[nameof(RegisterFailedAssigningRole)]
        };
        public static ValidationMessageData RegisterPasswordNotClaim => new()
        {
            Code = $"{nameof(RegisterPasswordNotClaim)}",
            Message = _localizer[nameof(RegisterPasswordNotClaim)]
        };
        public static ValidationMessageData RegisterSecretNotFound => new()
        {
            Code = $"{nameof(RegisterSecretNotFound)}",
            Message = _localizer[nameof(RegisterSecretNotFound)]
        };
        public static ValidationMessageData EmailErrorSending=> new()
        {
            Code = $"{nameof(EmailErrorSending)}",
            Message = _localizer[nameof(EmailErrorSending)]
        };

        public static ValidationMessageData ForgotPasswordGreetingMessage => new()
        {
            Code = $"{nameof(ForgotPasswordGreetingMessage)}",
            Message = _localizer[nameof(ForgotPasswordGreetingMessage)]
        };

        public static ValidationMessageData ForgotPasswordActionInstructions => new()
        {
            Code = $"{nameof(ForgotPasswordActionInstructions)}",
            Message = _localizer[nameof(ForgotPasswordActionInstructions)]
        };

        public static ValidationMessageData ForgotPasswordActionText => new()
        {
            Code = $"{nameof(ForgotPasswordActionText)}",
            Message = _localizer[nameof(ForgotPasswordActionText)]
        };

        public static ValidationMessageData ForgotPasswordExpirationMessage => new()
        {
            Code = $"{nameof(ForgotPasswordExpirationMessage)}",
            Message = _localizer[nameof(ForgotPasswordExpirationMessage)]
        };
        public static ValidationMessageData ForgotPasswordIgnoreMessage => new()
        {
            Code = $"{nameof(ForgotPasswordIgnoreMessage)}",
            Message = _localizer[nameof(ForgotPasswordIgnoreMessage)]
        };
        public static ValidationMessageData ForgotPasswordResetSubject => new()
        {
            Code = $"{nameof(ForgotPasswordResetSubject)}",
            Message = _localizer[nameof(ForgotPasswordResetSubject)]
        };
        public static ValidationMessageData RoleDirective => new()
        {
            Code = $"{nameof(RoleDirective)}",
            Message = _localizer[nameof(RoleDirective)]
        };

        public static ValidationMessageData RoleCoach => new()
        {
            Code = $"{nameof(RoleCoach)}",
            Message = _localizer[nameof(RoleCoach)]
        };

        public static ValidationMessageData RoleClubMember => new()
        {
            Code = $"{nameof(RoleClubMember)}",
            Message = _localizer[nameof(RoleClubMember)]
        };
        public static ValidationMessageData RolePlayer => new()
        {
            Code = $"{nameof(RolePlayer)}",
            Message = _localizer[nameof(RolePlayer)]
        };
        public static ValidationMessageData RoleFamilyPlayer => new()
        {
            Code = $"{nameof(RoleFamilyPlayer)}",
            Message = _localizer[nameof(RoleFamilyPlayer)]
        };
        public static ValidationMessageData RoleFollower => new()
        {
            Code = $"{nameof(RoleFollower)}",
            Message = _localizer[nameof(RoleFollower)]
        };

        public static ValidationMessageData UserClubNotRolePermissive => new()
        {
            Code = $"{nameof(UserClubNotRolePermissive)}",
            Message = _localizer[nameof(UserClubNotRolePermissive)]
        };

        public static ValidationMessageData UserClubNotValidUserId => new()
        {
            Code = $"{nameof(UserClubNotValidUserId)}",
            Message = _localizer[nameof(UserClubNotValidUserId)]
        };
        public static ValidationMessageData UserClubNotValidClubId => new()
        {
            Code = $"{nameof(UserClubNotValidClubId)}",
            Message = _localizer[nameof(UserClubNotValidClubId)]
        };
    }
}
