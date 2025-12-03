namespace RFFM.Api.Features.Federation.Teams.Services
{
    public interface IGoalMinuteParser
    {
        /// <summary>
        /// Parse minute strings like "45" or "45+2" into main minute and total minute (main + added).
        /// Returns (-1, -1) when cannot parse.
        /// </summary>
        (int Main, int Total) Parse(string? minute);
    }
}