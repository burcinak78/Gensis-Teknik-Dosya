"""Create long-value teknik dosyalar through the API and download every document (z8qgvccjc8).

Local or dev stack with db/dev-seed + fixture.sql loaded. Usage:
  python3 -I run.py --base http://127.0.0.1:10201 --password-file <file> --out <dir>
Writes <dir>/<variant>/<code>.pdf; measure.py then looks for overlapping or off-page text.
--values normal uses everyday lengths (and should run without fixture.sql) to compare page counts.
"""
import argparse, http.cookiejar, json, os, sys, time, urllib.request, urllib.error

COMPANY = "7e570001-0000-4000-8000-000000000002"   # TEST-ALFA
CODES = ["kapak", "dilekce", "firma_bilgileri", "tescil", "garanti", "bakim_sozlesmesi", "muh_taahhut_makine",
         "muh_taahhut_elektrik", "uygunluk_beyani", "yazili_beyanname", "teknik_komponent", "motor_beyannamesi",
         "son_kontrol_formu", "kullanma_bakim_klavuzu", "seyir_defteri", "egitim_tutanagi", "teslim_tutanagi"]
LONG = "TESTUZUNDEGERBOSLUKSUZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
KATLAR = ["-2", "-1", "Z", "ASMA KAT", "1", "2", "3", "4", "5", "6"]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None

def client(base, email, password):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), NoRedirect)
    def call(method, path, body=None, raw=False):
        req = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                     headers={"content-type": "application/json", "user-agent": "gtd-pdf-overflow-check"})
        try:
            with op.open(req, timeout=120) as r:
                data = r.read()
                return r.status, data if raw else (json.loads(data) if data else None)
        except urllib.error.HTTPError as e:
            return e.code, e.read()
    for _ in range(60):  # the stack may still be starting (502/503)
        try:
            s, _ = call("POST", "/api/auth/login", {"email": email, "password": password})
        except OSError:
            s = 0
        if s == 200: break
        if s not in (0, 502, 503, 504): sys.exit(f"login failed: {s}")
        time.sleep(2)
    else:
        sys.exit("login failed: stack not reachable")
    return call

def input_data(hid):
    return {
        "aski_tipi": "1/1", "kat_kapisi": "Otomatik Teleskopik Kat Kapısı Uzun Açıklama", "montaj_adresi": None,
        "pafta": "TEST-PAFTA-" + LONG[:20], "ada": "TEST-ADA-123456789", "parsel": "TEST-PARSEL-987654321",
        "yapi_sahibi": "TEST-Yapı Sahibi Çok Uzun İsimli Konut Yapı Kooperatifi Başkanlığı Yönetim Kurulu",
        "yapi_sahibi_adresi": "TEST Mah. Uzun Sokak Adı No: 12/34 Daire 56 Kadıköy İstanbul Türkiye Posta Kodu 34000",
        "asansor_seri_no": "TEST-SERI-" + LONG, "asansor_kimlik_no": "TEST-KIMLIK-" + LONG[:30],
        "seyir_mesafesi": "123.45", "motor_gucu": "15.5", "giris_sayisi": "2", "asansor_sayisi": 1,
        "tampon_kabin_sayisi": 2, "tampon_agirlik_sayisi": None if hid else 2, "kabin_kilidi_yok": False,
        "asansor_tipi": "hidrolik" if hid else "elektrik",
        "ilgili_idare": "TEST-Çok Uzun İsimli Büyükşehir Belediyesi İmar ve Şehircilik Daire Başkanlığı",
        "piston_olculeri": "TEST-PISTON-" + LONG[:25], "piston_yeri": "Yan Taraf Arka Köşe", "debi": "120",
        "unite_bilgisi": "TEST-UNITE-" + LONG[:30], "asansor_sinifi": "Sınıf II: İnsan + Yük Asansörü",
        "kapi_genislik": "900", "kapi_yukseklik": "2100", "kabin_genislik": "1400", "kabin_derinlik": "1600",
        "kabin_agirligi": "750", "karsi_agirlik_yeri": "Arka Taraf Uzun Açıklama", "karsi_agirlik_agirligi": "1100",
        "motor_marka": "TEST-MOTOR-" + LONG[:30], "makine_dairesi": "var",
        "baslangic_kat": "-2", "kat_sayisi": str(len(KATLAR)), "ara_katlar": [], "kat_listesi": KATLAR,
        "modul_secim": "G", "modul_belge_ids": [], "modul_g": {"belge_no": "TEST-G-" + LONG[:30], "verilis": "2026-01-01", "gecerlilik": "2030-01-01", "nb_id": ""},
        "fatura_no": "TEST-FATURA-" + LONG[:20], "fatura_tarihi": "2026-11-01", "periyodik_tarihi": "2026-11-01",
        "proje_no": "TEST-PROJE-" + LONG[:20],
        "modul_belge_no": "TEST-MODUL-" + LONG[:30], "modul_belge_tarihi": "2026-01-01",
        "modul_onaylanmis_kurulus": "TEST-Onaylanmış Kuruluş Uzun Adı Belgelendirme ve Muayene Hizmetleri A.Ş.",
        "modul_kurulus_no": "T901", "sanayi_sicil_no": "TEST-SICIL-" + LONG[:25], "sanayi_sicil_tarihi": "2020-01-01",
        "tse_tarihi": "2024-01-01", "tse_gecerlilik": "2027-01-01",
    }

def equipment(eq, hid):
    cats = {c["id"]: c for c in eq["categories"]}
    out = []
    for c in eq["categories"]:
        if c["driveType"] not in ("both", "hidrolik" if hid else "elektrik"): continue
        brands = [b for b in eq["brands"] if b["categoryId"] == c["id"]]
        if not brands: continue
        models = [m for m in eq["models"] if m["brandId"] == brands[0]["id"]]
        nospace = next((m for m in models if " " not in m["name"]), models[0] if models else None)
        slots = ["kabin"] + ([] if hid else ["agirlik"]) if c["code"] == "tampon" else ["main"]
        for slot in slots:
            seri_list = None
            if c["code"] == "kapi_kilidi": seri_list = [f"TEST-KK-{i}-{LONG[:18]} / TEST-KK-{i}B-{LONG[:12]}" for i in range(len(KATLAR))]
            elif c["code"] == "kabin_kilidi": seri_list = [f"TEST-KBK-{i}-{LONG[:20]}" for i in range(2)]
            elif c["code"] == "tampon": seri_list = [f"TEST-TMP-{slot}-{i}-{LONG[:16]}" for i in range(2)]
            out.append({"categoryId": c["id"], "slot": slot, "brandId": brands[0]["id"],
                        "modelId": nospace["id"] if nospace else None, "certificateId": nospace["certificateId"] if nospace else None,
                        "seriNo": "TEST-SN-" + LONG, "seriList": seri_list})
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:10201")
    ap.add_argument("--email", default="test-gensis@example.com")
    ap.add_argument("--password-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--keep", action="store_true", help="keep the created teknik dosyalar")
    ap.add_argument("--values", choices=["long", "normal"], default="long",
                    help="normal: everyday lengths, to check one-page documents stay one page (run without fixture.sql)")
    a = ap.parse_args()
    global LONG
    if a.values == "normal": LONG = "0042"
    call = client(a.base, a.email, open(a.password_file).read().strip())
    s, eq = call("GET", "/api/catalog/equipment")
    s, eng = call("GET", "/api/catalog/engineers")
    gensis = [e for e in eng["engineers"] if e["companyId"] == eng.get("gensisCompanyId")] or eng["engineers"]
    mak = next((e["id"] for e in gensis if e["discipline"] == "makine"), None)
    ele = next((e["id"] for e in gensis if e["discipline"].startswith("elektrik")), None)
    created = []
    for variant, hid in (("elektrik", False), ("hidrolik", True)):
        body = {"companyId": COMPANY, "dosyaNo": f"TEST-TASMA-{variant.upper()}-{LONG[:24]}", "dosyaTarihi": "2026-11-07",
                "makineMuhendisId": mak, "elektrikMuhendisId": ele,
                "binaAdi": "TEST-Bina Adı Çok Uzun Rezidans ve Alışveriş Merkezi A Blok Konutları " + LONG[:20],
                "montajAdresi": "TEST Montaj Adresi Mahallesi Uzun Cadde No: 1/2 Kat 3 Kadıköy İstanbul " + LONG[:20],
                "provinceId": 34, "districtId": "7e570013-0000-4000-8000-000000000001",
                "beyanYukuKg": 1000, "kisiSayisi": 13, "beyanHizi": 1.6, "katAdedi": len(KATLAR), "durakAdedi": len(KATLAR),
                "imalYili": 2026, "inputData": input_data(hid), "equipment": equipment(eq, hid)}
        s, p = call("POST", "/api/projects", body)
        if s != 201: sys.exit(f"create {variant}: {s} {p}")
        created.append(p["id"])
        os.makedirs(os.path.join(a.out, variant), exist_ok=True)
        for code in CODES:
            s, pdf = call("GET", f"/api/pdf/teknik-dosya?projectId={p['id']}&belge={code}", raw=True)
            ok = s == 200 and pdf[:4] == b"%PDF"
            print(f"{variant:9} {code:24} {'ok' if ok else f'HTTP {s}'}")
            if ok: open(os.path.join(a.out, variant, code + ".pdf"), "wb").write(pdf)
    if not a.keep:
        for pid in created: call("DELETE", f"/api/projects/{pid}")

if __name__ == "__main__":
    main()
