using System.Threading.Channels;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public abstract record RffmResultsJob;

    public record FetchMatchRecordJob(string RecordCode, int SeasonId, string CompetitionCode, string GroupCode) : RffmResultsJob;

    public record RefreshStandingsJob(string GroupCode, int Round) : RffmResultsJob;

    public interface IRffmResultsJobQueue
    {
        ValueTask EnqueueAsync(RffmResultsJob job, CancellationToken cancellationToken = default);

        IAsyncEnumerable<RffmResultsJob> DequeueAllAsync(CancellationToken cancellationToken);
    }

    public class RffmResultsJobQueue : IRffmResultsJobQueue
    {
        private readonly Channel<RffmResultsJob> _channel =
            Channel.CreateUnbounded<RffmResultsJob>(new UnboundedChannelOptions { SingleReader = true });

        public ValueTask EnqueueAsync(RffmResultsJob job, CancellationToken cancellationToken = default) =>
            _channel.Writer.WriteAsync(job, cancellationToken);

        public IAsyncEnumerable<RffmResultsJob> DequeueAllAsync(CancellationToken cancellationToken) =>
            _channel.Reader.ReadAllAsync(cancellationToken);
    }
}
