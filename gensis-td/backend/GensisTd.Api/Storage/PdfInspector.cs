using System.Text;

namespace GensisTd.Api.Storage;

public enum PdfInspection { Ok, NotPdf, Encrypted }

/// <summary>
/// Upload check for library PDFs: the file starts with %PDF- and has no /Encrypt anywhere. The trailer or
/// cross-reference dictionary that declares encryption is never compressed, so a byte scan finds it. A file
/// that merely contains the word in clear text is rejected too; that is the safe side of the mistake.
/// Reads in chunks, keeping enough of each one to match across the boundary, so memory stays flat.
/// </summary>
public static class PdfInspector
{
    private static readonly byte[] Header = Encoding.ASCII.GetBytes("%PDF-");
    private static readonly byte[] EncryptName = Encoding.ASCII.GetBytes("/Encrypt");

    public static async Task<PdfInspection> InspectAsync(Stream stream, int chunkSize = 64 * 1024, CancellationToken ct = default)
    {
        var buffer = new byte[Math.Max(chunkSize, EncryptName.Length) + EncryptName.Length - 1];
        var kept = 0;
        var headerChecked = false;
        while (true)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(kept, buffer.Length - kept), ct);
            var length = kept + read;
            if (!headerChecked && (length >= Header.Length || read == 0))
            {
                if (!buffer.AsSpan(0, length).StartsWith(Header)) return PdfInspection.NotPdf;
                headerChecked = true;
            }
            if (headerChecked && buffer.AsSpan(0, length).IndexOf(EncryptName) >= 0) return PdfInspection.Encrypted;
            if (read == 0) return headerChecked ? PdfInspection.Ok : PdfInspection.NotPdf;

            // Before the header is decided nothing may be dropped; afterwards only a possible partial match is kept.
            kept = headerChecked ? Math.Min(length, EncryptName.Length - 1) : length;
            if (headerChecked) buffer.AsSpan(length - kept, kept).CopyTo(buffer);
        }
    }
}
