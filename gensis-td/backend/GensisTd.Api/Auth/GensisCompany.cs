namespace GensisTd.Api.Auth;

/// <summary>
/// Gensis's own company record, whose engineers every customer may pick. KRR-023: it comes from
/// configuration (GENSIS_COMPANY_ID), not from the company name, which customers can now ask to change.
/// Without it Gensis engineers are simply not offered to customers.
/// </summary>
public sealed class GensisCompany
{
    public Guid? Id { get; }

    public GensisCompany(IConfiguration config, ILogger<GensisCompany> logger)
    {
        var raw = config["GENSIS_COMPANY_ID"];
        if (string.IsNullOrWhiteSpace(raw))
        {
            logger.LogWarning("GENSIS_COMPANY_ID is not set; Gensis engineers are not offered to customers");
            return;
        }
        Id = Guid.TryParse(raw, out var id) ? id : throw new InvalidOperationException("GENSIS_COMPANY_ID is not a valid id");
    }
}
