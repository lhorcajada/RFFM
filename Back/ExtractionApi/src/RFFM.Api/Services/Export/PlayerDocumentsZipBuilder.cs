using System.IO.Compression;
using System.Linq;

namespace RFFM.Api.Services.Export
{
    public class PlayerDocumentsZipBuilder
    {
        public byte[] BuildZip(IEnumerable<PlayerDocumentZipEntry> entries)
        {
            using var ms = new MemoryStream();
            using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
            {
                var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var entry in entries)
                {
                    var fileName = MakeUniqueFileName(entry.FileName, usedNames);
                    var zipEntry = archive.CreateEntry(fileName, CompressionLevel.Optimal);
                    using var entryStream = zipEntry.Open();
                    entryStream.Write(entry.Content, 0, entry.Content.Length);
                }
            }
            return ms.ToArray();
        }

        private static string MakeUniqueFileName(string fileName, HashSet<string> usedNames)
        {
            var candidate = SanitizeFileName(fileName);
            if (usedNames.Add(candidate)) return candidate;

            var extension = Path.GetExtension(candidate);
            var baseName = Path.GetFileNameWithoutExtension(candidate);
            var counter = 2;
            string next;
            do
            {
                next = $"{baseName}_{counter}{extension}";
                counter++;
            } while (!usedNames.Add(next));
            return next;
        }

        private static string SanitizeFileName(string fileName)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var sanitized = new string(fileName.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
            return string.IsNullOrWhiteSpace(sanitized) ? "documento" : sanitized;
        }
    }

    public record PlayerDocumentZipEntry(string FileName, byte[] Content);
}
