using System.Linq.Expressions;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Projects;

/// <summary>
/// Removes the accounting (takip) rows a teknik dosya created via "muhasebeye gönder", used when the
/// project is deleted or taken out of accounting. Callers must have checked access to the project.
/// </summary>
public static class TakipCleanup
{
    /// <summary>
    /// Same TD number, not yet posted (cariye işlendi), and owned by the project's company or by no
    /// company. KRR-013: a row whose company differs (staff reassigned it) is never removed. Live data
    /// 2026-10-21: 63 takip rows, none with NULL company, none linked to a project by TD number.
    /// </summary>
    public static Expression<Func<TakipProjeler, bool>> RemovableFor(Project project)
    {
        var tdNo = project.TdNo;
        var companyId = project.CompanyId;
        return t => tdNo != null && t.TdNo == tdNo
            && (t.CompanyId == companyId || t.CompanyId == null)
            && (t.TakipMuhasebe == null || !t.TakipMuhasebe.CariyeIslendi);
    }

    public static Task<int> RemoveUnpostedAsync(AppDbContext db, Project project, CancellationToken ct) =>
        string.IsNullOrEmpty(project.TdNo)
            ? Task.FromResult(0)
            : db.TakipProjelers.Where(RemovableFor(project)).ExecuteDeleteAsync(ct);
}
