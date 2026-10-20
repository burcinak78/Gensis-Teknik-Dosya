namespace GensisTd.Api.Data;

public static class Collations
{
    /// <summary>
    /// ICU Turkish ordering (C &lt; Ç, I &lt; İ, O &lt; Ö) for user-facing name sorts. Applied per query
    /// with EF.Functions.Collate rather than as the database default, so ILIKE / lower() keep
    /// non-Turkish case rules (Turkish ctype would make 'GENSIS' ILIKE 'gensis' false).
    /// </summary>
    public const string Turkish = "tr-x-icu";
}
