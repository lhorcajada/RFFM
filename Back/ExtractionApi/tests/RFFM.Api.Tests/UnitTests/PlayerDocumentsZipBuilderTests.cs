#nullable enable
using System.IO.Compression;
using RFFM.Api.Services.Export;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerDocumentsZipBuilderTests
    {
        [Fact]
        public void BuildZip_WithMultipleEntries_ReturnsZipContainingAllFiles()
        {
            var builder = new PlayerDocumentsZipBuilder();
            var entries = new List<PlayerDocumentZipEntry>
            {
                new("Juan.pdf", new byte[] { 1, 2, 3 }),
                new("Carlos.pdf", new byte[] { 4, 5, 6, 7 })
            };

            var zipBytes = builder.BuildZip(entries);

            Assert.NotNull(zipBytes);
            Assert.NotEmpty(zipBytes);

            using var ms = new MemoryStream(zipBytes);
            using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
            Assert.Equal(2, archive.Entries.Count);
            Assert.Contains(archive.Entries, e => e.Name == "Juan.pdf");
            Assert.Contains(archive.Entries, e => e.Name == "Carlos.pdf");
        }

        [Fact]
        public void BuildZip_WithDuplicateFileNames_MakesEntriesUnique()
        {
            var builder = new PlayerDocumentsZipBuilder();
            var entries = new List<PlayerDocumentZipEntry>
            {
                new("Juan.pdf", new byte[] { 1 }),
                new("Juan.pdf", new byte[] { 2 })
            };

            var zipBytes = builder.BuildZip(entries);

            using var ms = new MemoryStream(zipBytes);
            using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
            Assert.Equal(2, archive.Entries.Count);
            Assert.Contains(archive.Entries, e => e.Name == "Juan.pdf");
            Assert.Contains(archive.Entries, e => e.Name == "Juan_2.pdf");
        }

        [Fact]
        public void BuildZip_PreservesFileContent()
        {
            var builder = new PlayerDocumentsZipBuilder();
            var content = new byte[] { 10, 20, 30, 40 };
            var entries = new List<PlayerDocumentZipEntry> { new("doc.pdf", content) };

            var zipBytes = builder.BuildZip(entries);

            using var ms = new MemoryStream(zipBytes);
            using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
            var entry = archive.Entries.Single();
            using var entryStream = entry.Open();
            using var resultMs = new MemoryStream();
            entryStream.CopyTo(resultMs);
            Assert.Equal(content, resultMs.ToArray());
        }
    }
}
