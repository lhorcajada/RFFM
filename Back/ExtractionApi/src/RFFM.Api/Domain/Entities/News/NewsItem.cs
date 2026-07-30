namespace RFFM.Api.Domain.Entities.News
{
    public class NewsItem : BaseEntity
    {
        public string Title { get; private set; } = null!;
        public string Subtitle { get; private set; } = null!;
        public string Body { get; private set; } = null!;
        public string CoverImageUrl { get; private set; } = null!;
        public NewsStatus Status { get; private set; } = null!;
        public DateTime? PublishedAt { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        private NewsItem() { }

        public static NewsItem Create(string title, string subtitle, string body, string coverImageUrl, NewsStatus status)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("El título es obligatorio.");
            if (string.IsNullOrWhiteSpace(subtitle))
                throw new ArgumentException("La entradilla es obligatoria.");
            if (string.IsNullOrWhiteSpace(body))
                throw new ArgumentException("El cuerpo es obligatorio.");
            if (string.IsNullOrWhiteSpace(coverImageUrl))
                throw new ArgumentException("La foto de portada es obligatoria.");
            if (status is null)
                throw new ArgumentException("El estado es obligatorio.");

            var now = DateTime.UtcNow;
            return new NewsItem
            {
                Title = title.Trim(),
                Subtitle = subtitle.Trim(),
                Body = body,
                CoverImageUrl = coverImageUrl,
                Status = status,
                PublishedAt = status == NewsStatus.Published ? now : null,
                CreatedAt = now,
                UpdatedAt = now
            };
        }

        public void UpdateContent(string title, string subtitle, string body, string coverImageUrl)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("El título es obligatorio.");
            if (string.IsNullOrWhiteSpace(subtitle))
                throw new ArgumentException("La entradilla es obligatoria.");
            if (string.IsNullOrWhiteSpace(body))
                throw new ArgumentException("El cuerpo es obligatorio.");
            if (string.IsNullOrWhiteSpace(coverImageUrl))
                throw new ArgumentException("La foto de portada es obligatoria.");

            Title = title.Trim();
            Subtitle = subtitle.Trim();
            Body = body;
            CoverImageUrl = coverImageUrl;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Publish()
        {
            if (Status == NewsStatus.Published)
                throw new RFFM.Api.Domain.ConflictException("La noticia ya está publicada.", RFFM.Api.Domain.ErrorCodes.NewsAlreadyPublished);

            Status = NewsStatus.Published;
            PublishedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
