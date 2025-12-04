namespace RFFM.Api.Domain
{
    public class DomainException : Exception
    {
        public string Code { get; set; }
        public string Title { get; init; }

        public string Description { get; init; }

        public DomainException(string title, string description, string code)
            : base(description)
        {
            Title = title;
            Description = description;
            Code = code;
        }
    }
}
