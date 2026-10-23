using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace GensisTd.Api.Email;

public class EmailOptions
{
    // Resend API key, limited to sending from the app's domain. From env (Email__ResendApiKey); never logged.
    public string ResendApiKey { get; set; } = "";
    // e.g. "Gensis Teknik Dosya <noreply@dosyalift.com>" (Email__From).
    public string From { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrEmpty(ResendApiKey) && !string.IsNullOrEmpty(From);
}

public record EmailMessage(string To, string Subject, string Html, string Text);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).</summary>
public sealed class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options) : IEmailSender
{
    public static readonly Uri Endpoint = new("https://api.resend.com/emails");

    public async Task SendAsync(EmailMessage m, CancellationToken ct)
    {
        var o = options.Value;
        using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = JsonContent.Create(new { from = o.From, to = new[] { m.To }, subject = m.Subject, html = m.Html, text = m.Text }),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", o.ResendApiKey);
        using var res = await http.SendAsync(req, ct);
        // The body may echo the request; only the status goes into the exception (and the log).
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Resend answered {(int)res.StatusCode}");
    }
}
