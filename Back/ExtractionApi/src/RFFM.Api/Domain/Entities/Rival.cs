namespace RFFM.Api.Domain.Entities
{
    public class Rival : BaseEntity
    {
        public string Name { get; private set; }
        public string? UrlPhoto { get; private set; }
        private Rival() { }

        public Rival(string name, string? urlPhoto)
        {
            SetName(name);
            SetUrlPhoto(urlPhoto);
        }

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ArgumentException("El nombre no puede estar vacío");
            if (name.Length > 100)
                throw new ArgumentException("El nombre no puede tener más de 100 caracteres");
            Name = name;
        }
        public void SetUrlPhoto(string? urlPhoto)
        {
            if (urlPhoto != null && urlPhoto.Length > 256)
                throw new ArgumentException("La URL de la foto no puede tener más de 256 caracteres");
            UrlPhoto = urlPhoto;
        }
    }
}
