using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Projects;

/// <summary>
/// The müellif engineers of a teknik dosya or proje onay file are registered to the file's company or to
/// Gensis (Gensis engineers work on every customer's files and are the default). Holds for staff too.
/// KRR-021: keeps a customer from attaching another company's engineer and reading their documents.
/// </summary>
public static class EngineerRule
{
    public static async Task<IResult?> ValidateAsync(AppDbContext db, Guid companyId, Guid? makine, Guid? elektrik, Guid? gensisId,
        CancellationToken ct)
    {
        var ids = new[] { makine, elektrik }.OfType<Guid>().Distinct().ToList();
        if (ids.Count == 0) return null;
        var candidates = db.Engineers.Where(e => ids.Contains(e.Id));
        candidates = gensisId is { } gid
            ? candidates.Where(e => e.CompanyId == companyId || e.CompanyId == gid)
            : candidates.Where(e => e.CompanyId == companyId);
        return await candidates.CountAsync(ct) == ids.Count
            ? null
            : Results.ValidationProblem(new Dictionary<string, string[]> { ["engineer"] = ["Mühendis, projenin firmasına ya da Gensis'e kayıtlı olmalı."] });
    }
}
