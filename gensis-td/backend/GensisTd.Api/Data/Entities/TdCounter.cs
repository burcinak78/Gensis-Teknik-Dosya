namespace GensisTd.Api.Data.Entities;

/// <summary>Last TD number handed out per year (TD-YY-NNNN). Code-first; not in the Supabase schema.</summary>
public class TdCounter
{
    public short Year { get; set; }
    public int LastNo { get; set; }
}
