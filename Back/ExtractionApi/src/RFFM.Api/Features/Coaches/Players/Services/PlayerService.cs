using Azure.Storage.Blobs;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    public class PlayerService : IPlayerService
    {
        private readonly AppDbContext _catalogDbContext;
        private readonly BlobServiceClient _blobServiceClient;
        public PlayerService(AppDbContext catalogDbContext, BlobServiceClient blobServiceClient)
        {
            _catalogDbContext = catalogDbContext;
            _blobServiceClient = blobServiceClient;
        }

        public async Task<Player> AddPlayerClub(CreatePlayerModel request, CancellationToken cancellationToken)
        {
            var club = await _catalogDbContext.Clubs
                .FirstOrDefaultAsync(c => c.Id == request.ClubId);
            if (club == null)
                throw new DomainException("Club", $"Club does not exist {request.ClubId}", "ClubNotExist");

            string? urlPhoto = null;

            if (request.PhotoFile != null && request.PhotoFile.Length > 0)
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(PlayerConstants.PlayersContainerName);
                await containerClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

                var fileName = Guid.NewGuid() + Path.GetExtension(request.PhotoFile.FileName);
                var blobClient = containerClient.GetBlobClient($"{club.Id}/{fileName}");

                await using var stream = request.PhotoFile.OpenReadStream();
                await blobClient.UploadAsync(stream, cancellationToken);

                urlPhoto = blobClient.Uri.ToString();
            }
            var newPlayer = Player.Create(new PlayerModel
            {
                Name = request.Name,
                ClubId = request.ClubId,
                Alias = request.Alias,
                BirthDate = request.BirthDate,
                Dni = request.Dni,
                LastName = request.LastName,
                UrlPhoto = urlPhoto
            });

            await _catalogDbContext.Players.AddAsync(newPlayer, cancellationToken);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return newPlayer;
        }
    }

    
}
