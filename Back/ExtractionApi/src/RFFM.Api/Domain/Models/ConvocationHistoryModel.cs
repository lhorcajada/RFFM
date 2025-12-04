namespace RFFM.Api.Domain.Models
{
    public class ConvocationHistoryModel
    {
        public string ConvocationId { get; set; }
        public string UserId { get; set; }
        public DateTime ChangeDateTime { get; set; }
        public int OldStatusId { get; set; }
        public int NewStatusId { get; set; }

    }
}
