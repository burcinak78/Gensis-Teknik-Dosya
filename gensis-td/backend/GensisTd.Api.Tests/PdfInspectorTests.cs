using System.Text;
using GensisTd.Api.Endpoints;
using GensisTd.Api.Storage;

namespace GensisTd.Api.Tests;

public class PdfInspectorTests
{
    private static Task<PdfInspection> Inspect(string content, int chunk = 64 * 1024) =>
        PdfInspector.InspectAsync(new MemoryStream(Encoding.ASCII.GetBytes(content)), chunk);

    [Fact]
    public async Task Plain_pdf_passes() => Assert.Equal(PdfInspection.Ok, await Inspect("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"));

    [Theory]
    [InlineData("")]
    [InlineData("%PD")]
    [InlineData("<html><body>%PDF-1.7</body></html>")]
    [InlineData(" %PDF-1.7")]
    public async Task Anything_else_is_not_a_pdf(string content) => Assert.Equal(PdfInspection.NotPdf, await Inspect(content));

    [Fact]
    public async Task Encrypt_is_found_on_every_chunk_boundary()
    {
        foreach (var chunk in new[] { 1, 8, 9, 16, 64 })
            for (var padding = 0; padding < 200; padding++)
                Assert.Equal(PdfInspection.Encrypted, await Inspect("%PDF-1.7\n" + new string('x', padding) + "/Encrypt 5 0 R", chunk));
    }

    [Fact]
    public async Task Stream_that_returns_little_at_a_time_is_still_read_whole()
    {
        var bytes = Encoding.ASCII.GetBytes("%PDF-1.7\n" + new string('x', 1000) + "/Encrypt");
        Assert.Equal(PdfInspection.Encrypted, await PdfInspector.InspectAsync(new TrickleStream(bytes)));
    }

    [Theory]
    [InlineData("rapor.pdf", "rapor.pdf")]
    [InlineData("../../etc/passwd", "passwd")]
    [InlineData("C:\\belgeler\\sozlesme.pdf", "sozlesme.pdf")]
    [InlineData("a\r\nb.pdf", "ab.pdf")]
    [InlineData("", "dokuman.pdf")]
    [InlineData(null, "dokuman.pdf")]
    public void File_names_are_cleaned(string? name, string expected) => Assert.Equal(expected, DocumentLibraryEndpoints.CleanName(name));

    [Fact]
    public void Long_file_names_are_bounded() => Assert.Equal(200, DocumentLibraryEndpoints.CleanName(new string('a', 500)).Length);

    private sealed class TrickleStream(byte[] content) : MemoryStream(content)
    {
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) =>
            base.ReadAsync(buffer[..Math.Min(buffer.Length, 3)], ct);
    }
}
