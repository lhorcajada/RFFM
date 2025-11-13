using Mediator;

namespace RFFM.Api.Common;

public interface IBaseQuery 
{
}

public interface IQuery : IRequest, IBaseQuery
{
}

public interface IQuery<T> : IRequest<T>, IBaseQuery where T : class
{
}