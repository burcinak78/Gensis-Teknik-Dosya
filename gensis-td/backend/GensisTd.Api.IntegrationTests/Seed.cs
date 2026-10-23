using Npgsql;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// Two customer companies (ALFA, BETA) and Gensis, each with users, engineers, documents and files.
/// Every ALFA row has a BETA twin, so a test can ask for the other company's row by id.
/// Written as the owner with SQL, not through the API, so the data does not depend on the code under test.
/// </summary>
public static class Seed
{
    public const string Password = "Test-Parola-2026";

    public static readonly Guid CompanyA = G(0xA0), CompanyB = G(0xB0), CompanyGensis = G(0xC0);

    public const string Admin = "admin@it.test", Staff = "staff@it.test", Muhasebeci = "muhasebe@it.test",
        CustomerA = "alfa@it.test", CustomerB = "beta@it.test", NoCompany = "firmasiz@it.test",
        Inactive = "pasif@it.test", SessionUser = "oturum@it.test";

    public static readonly Guid UserCustomerA = G(0xA1), UserCustomerB = G(0xB1), UserSession = G(0xA2);

    public static readonly Guid EngineerA = G(0xA3), EngineerB = G(0xB3), EngineerGensis = G(0xC3);
    public static readonly Guid EngineerDocA = G(0xA4), EngineerDocB = G(0xB4);
    public static readonly Guid CompanyDocA = G(0xA5), CompanyDocB = G(0xB5);

    // ProjectA2: a takip row with its TD number belongs to BETA (staff reassigned it, KRR-013).
    // ProjectA3: its takip row is posted (cariye işlendi) and must never change.
    public static readonly Guid ProjectA = G(0xA6), ProjectB = G(0xB6), ProjectA2 = G(0xA7), ProjectA3 = G(0xA8);
    public const string TdA = "TD-26-9001", TdB = "TD-26-9002", TdA2 = "TD-26-9003", TdA3 = "TD-26-9004";
    public static readonly Guid FileA = G(0xA9), FileB = G(0xB9);
    public static readonly Guid OnayA = G(0xAA), OnayB = G(0xBA);
    public static readonly Guid TakipBOnTdA2 = G(0xBB), TakipPostedA3 = G(0xAB), TakipB = G(0xBC);
    public static readonly Guid NoteA = G(0xAD), NoteB = G(0xBD);

    public const string FileAPath = "proje/a6/fatura-a.pdf", FileBPath = "proje/b6/fatura-b.pdf";
    public const string CompanyDocAPath = "musteri/a0/logo-a.png", CompanyDocBPath = "musteri/b0/logo-b.png";
    public const string EngineerDocAPath = "muhendis/a3/imza-a.png", EngineerDocBPath = "muhendis/b3/imza-b.png";

    public static readonly string[] StoredObjects =
        [FileAPath, FileBPath, CompanyDocAPath, CompanyDocBPath, EngineerDocAPath, EngineerDocBPath];

    private static Guid G(int n) => Guid.Parse($"00000000-0000-4000-8000-{n:x12}");

    public static async Task RunAsync(string ownerConnection)
    {
        await using var conn = new NpgsqlConnection(ownerConnection);
        await conn.OpenAsync();
        // Low cost factor: only test speed; login verifies whatever cost the hash carries.
        var hash = BCrypt.Net.BCrypt.HashPassword(Password, 4);

        var users = new (Guid Id, string Email, string Role, Guid? Company, bool Active)[]
        {
            (G(0xC1), Admin, "admin", CompanyGensis, true),
            (G(0xC2), Staff, "gensis", CompanyGensis, true),
            (G(0xC4), Muhasebeci, "muhasebeci", CompanyGensis, true),
            (UserCustomerA, CustomerA, "customer", CompanyA, true),
            (UserCustomerB, CustomerB, "customer", CompanyB, true),
            (G(0xD1), NoCompany, "customer", null, true),
            (G(0xA0A), Inactive, "customer", CompanyA, false),
            (UserSession, SessionUser, "customer", CompanyA, true),
        };

        var sql = new System.Text.StringBuilder($"""
            INSERT INTO companies (id, short_name, legal_name) VALUES
                ('{CompanyA}', 'ALFA', 'Alfa Asansör Ltd.'), ('{CompanyB}', 'BETA', 'Beta Asansör A.Ş.'),
                ('{CompanyGensis}', 'GENSIS', 'Gensis Mühendislik');
            """);
        foreach (var u in users)
            sql.Append($"""
                INSERT INTO users (id, email, password_hash) VALUES ('{u.Id}', '{u.Email}', @hash);
                INSERT INTO profiles (id, full_name, role, company_id, is_active)
                    VALUES ('{u.Id}', '{u.Email}', '{u.Role}', {(u.Company is { } c ? $"'{c}'" : "NULL")}, {u.Active});
                """);
        sql.Append($"""
            INSERT INTO engineers (id, full_name, discipline, company_id) VALUES
                ('{EngineerA}', 'Ali Alfa', 'makine', '{CompanyA}'), ('{EngineerB}', 'Burak Beta', 'makine', '{CompanyB}'),
                ('{EngineerGensis}', 'Gül Gensis', 'elektrik', '{CompanyGensis}');
            INSERT INTO engineer_documents (id, engineer_id, doc_type, storage_path) VALUES
                ('{EngineerDocA}', '{EngineerA}', 'imza', '{EngineerDocAPath}'), ('{EngineerDocB}', '{EngineerB}', 'imza', '{EngineerDocBPath}');
            INSERT INTO company_documents (id, company_id, doc_type, storage_path) VALUES
                ('{CompanyDocA}', '{CompanyA}', 'logo', '{CompanyDocAPath}'), ('{CompanyDocB}', '{CompanyB}', 'logo', '{CompanyDocBPath}');
            INSERT INTO projects (id, company_id, dosya_no, td_no, makine_muhendis_id, created_by) VALUES
                ('{ProjectA}', '{CompanyA}', 'ALFA-1', '{TdA}', '{EngineerA}', '{UserCustomerA}'),
                ('{ProjectB}', '{CompanyB}', 'BETA-1', '{TdB}', '{EngineerB}', '{UserCustomerB}'),
                ('{ProjectA2}', '{CompanyA}', 'ALFA-2', '{TdA2}', NULL, '{UserCustomerA}'),
                ('{ProjectA3}', '{CompanyA}', 'ALFA-3', '{TdA3}', NULL, '{UserCustomerA}');
            INSERT INTO project_files (id, project_id, kind, storage_path) VALUES
                ('{FileA}', '{ProjectA}', 'fatura', '{FileAPath}'), ('{FileB}', '{ProjectB}', 'fatura', '{FileBPath}');
            INSERT INTO proje_onay (id, company_id, dosya_no) VALUES
                ('{OnayA}', '{CompanyA}', 'ONAY-ALFA'), ('{OnayB}', '{CompanyB}', 'ONAY-BETA');
            INSERT INTO takip_projeler (id, proje_no, proje_tipi, company_id, td_no, muhasebeye_gonderildi, teslim_tipi) VALUES
                ('{TakipBOnTdA2}', 90001, 'uygulama', '{CompanyB}', '{TdA2}', true, 'dijital'),
                ('{TakipPostedA3}', 90002, 'uygulama', '{CompanyA}', '{TdA3}', true, 'dijital'),
                ('{TakipB}', 90003, 'uygulama', '{CompanyB}', '{TdB}', true, 'dijital');
            INSERT INTO takip_muhasebe (takip_id, cariye_islendi) VALUES ('{TakipPostedA3}', true);
            INSERT INTO notlar (id, user_id, icerik) VALUES
                ('{NoteA}', '{UserCustomerA}', 'Alfa notu'), ('{NoteB}', '{UserCustomerB}', 'Beta notu');
            """);

        await using var cmd = new NpgsqlCommand(sql.ToString(), conn);
        cmd.Parameters.AddWithValue("hash", hash);
        await cmd.ExecuteNonQueryAsync();
    }
}
