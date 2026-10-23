"""Equivalence run: what each user saw in the live app vs what the new C# API gives the same user.

Needs the rehearsal environment (prova.py up). Old side = the live Next app's reads replayed on the copy:
queries that ran with the user's session go through RLS (SET ROLE authenticated + request.jwt.claims);
queries that ran with the service role read everything and get the page's JavaScript filter applied here.
New side = the backend at 127.0.0.1:10212 with a session signed by the rehearsal JWT secret.

Users: every live account plus the rehearsal customer of every company (live has no customer accounts).
Dates: the live app used UTC (Vercel), the new one Europe/Istanbul; both are taken at run time.

Usage: python3 -I equivalence.py <copy> [--api <url>]
  --api <url>  another backend (prod over an SSH tunnel, e.g. http://127.0.0.1:10212) with the old side from
               `prova.py old-up <copy>`: no rehearsal customers, the session key comes from the environment variable
               GTD_JWT_SECRET (that backend's Auth__JwtSecret; never pass it as an argument), and the table/storage
               check is left to `migrate.py verify` on the server. Reading the takip list there moves overdue jobs
               to BEKLIYOR, as any first read in the app would.
Writes <copy>/rapor/esdegerlik-<time>.md (+ .json). Exit code 1 when there is an unexplained difference.
The report holds data from the copy: it stays in the copy folder (outside git) and goes with it.
"""
import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict

sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prova  # noqa: E402

API = f"http://127.0.0.1:{prova.BACKEND_PORT}"  # --api replaces it
STAFF = ("admin", "gensis")
OFFICE = ("admin", "gensis", "muhasebeci")
ZERO = "00000000-0000-0000-0000-000000000000"

# ---------------------------------------------------------------- normalisation

_TS = re.compile(r"^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:?\d\d)?$")


def snake(k):
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", k).lower()


def norm(v):
    """JSON from either side → comparable form: snake_case keys, UTC timestamps, plain numbers."""
    if isinstance(v, dict):
        return {snake(k): norm(x) for k, x in v.items()}
    if isinstance(v, list):
        return [norm(x) for x in v]
    if isinstance(v, float):
        return int(v) if v.is_integer() else round(v, 6)
    if isinstance(v, str):
        m = _TS.match(v)
        if m and m.group(4):
            frac = (m.group(3) or "").ljust(6, "0")[:6]
            tz = m.group(4).replace("Z", "+00:00")
            if len(tz) == 5:
                tz = tz[:3] + ":" + tz[3:]
            t = dt.datetime.fromisoformat(f"{m.group(1)}T{m.group(2)}.{frac}{tz}").astimezone(dt.timezone.utc)
            return t.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    return v


# ---------------------------------------------------------------- old side

def old_json(sql, role=None, uid=None):
    """One JSON value from the old side. role=None: service role (bypasses RLS, as createAdminClient)."""
    pre = "BEGIN READ ONLY; "
    if role:
        claims = json.dumps({"sub": uid, "role": role})
        pre += f"SET LOCAL ROLE {role}; SET LOCAL request.jwt.claims = '{claims}'; "
    return json.loads(prova.old_sql(f"{pre}SELECT ({sql})::jsonb::text; ROLLBACK;"))


def agg(sql):
    return f"(SELECT coalesce(json_agg(t), '[]'::json) FROM ({sql}) t)"


# Reads the live pages made with the user's session (RLS applies).
USER_QUERIES = {
    "me": "SELECT full_name, role, company_id FROM profiles WHERE id = auth.uid()",
    "projects_list": "SELECT p.id, p.dosya_no, p.td_no, p.status, p.bina_adi, p.beyan_yuku_kg, p.kat_adedi, p.created_at, "
                     "p.input_data, c.short_name AS company_short_name FROM projects p "
                     "LEFT JOIN companies c ON c.id = p.company_id ORDER BY p.created_at DESC LIMIT 100",
    "projects": "SELECT p.*, c.short_name AS company_short_name FROM projects p LEFT JOIN companies c ON c.id = p.company_id",
    "project_equipment": "SELECT * FROM project_equipment",
    "project_files": "SELECT * FROM project_files ORDER BY uploaded_at",
    "render_context": "SELECT id, project_render_context(id) AS ctx FROM projects",
    "companies": "SELECT * FROM companies ORDER BY short_name",
    "engineers": "SELECT id, full_name, discipline, chamber_reg_no, company_id FROM engineers ORDER BY full_name LIMIT 2000",
    "engineer_documents": "SELECT id, engineer_id, doc_type, valid_until FROM engineer_documents LIMIT 5000",
    "company_documents": "SELECT id, company_id, doc_type, belge_no, issue_date, valid_until, notified_body_id, "
                         "original_name, sub_type, parent_id FROM company_documents LIMIT 5000",
    "equipment_categories": "SELECT id, code, name, sort_order, drive_type FROM equipment_categories ORDER BY sort_order",
    "equipment_brands": "SELECT id, category_id, name FROM equipment_brands ORDER BY name",
    "equipment_models": "SELECT id, brand_id, name, certificate_id FROM equipment_models ORDER BY name",
    "certificates": "SELECT c.id, c.cert_no, c.notified_body_id, c.issue_date, c.valid_until, c.belge_tipi, c.category_id, "
                    "c.firma_adi, f.original_name AS current_file_name FROM certificates c "
                    "LEFT JOIN certificate_files f ON f.certificate_id = c.id AND f.is_current",
    "notified_bodies": "SELECT id, identity_no, name, short_name, address, city, country FROM notified_bodies ORDER BY short_name",
    "provinces": "SELECT id, name FROM provinces ORDER BY name",
    "districts": "SELECT id, name, province_id FROM districts ORDER BY name",
    "ilgili_idareler": "SELECT id, name, province_id, suffix, address FROM ilgili_idareler ORDER BY name LIMIT 8000",
    "capacity": "SELECT beyan_yuku_kg, kisi_sayisi, kabin_agirlik_kg, karsi_agirlik_kg FROM capacity_table ORDER BY beyan_yuku_kg",
    "lookups": "SELECT list_key, value, sort_order FROM lookup_values ORDER BY sort_order",
    "proje_onay_list": "SELECT o.id, o.dosya_no, o.status, o.yapi_sahibi, o.beyan_yuku_kg, o.durak_sayisi, o.dilekce_tarihi, "
                       "o.created_at, o.input_data, c.short_name AS company_short_name FROM proje_onay o "
                       "LEFT JOIN companies c ON c.id = o.company_id ORDER BY o.created_at DESC LIMIT 300",
    "proje_onay": "SELECT * FROM proje_onay",
    "notes": "SELECT id, icerik, sayac_baslangic, created_at FROM notlar ORDER BY created_at DESC",
    "profiles": "SELECT p.id, p.full_name, p.role, p.is_active, p.company_id, c.short_name AS company_short_name "
                "FROM profiles p LEFT JOIN companies c ON c.id = p.company_id ORDER BY p.created_at DESC LIMIT 1000",
}

# Reads the live pages made with the service role; filtered per user below like the page did.
SR_QUERIES = {
    "company_documents": "SELECT d.*, c.short_name FROM company_documents d LEFT JOIN companies c ON c.id = d.company_id",
    "engineer_documents": "SELECT d.*, e.full_name, e.discipline, e.company_id FROM engineer_documents d "
                          "LEFT JOIN engineers e ON e.id = d.engineer_id",
    "certificates": "SELECT c.*, k.name AS category_name FROM certificates c LEFT JOIN equipment_categories k ON k.id = c.category_id",
    "certificate_files": "SELECT * FROM certificate_files WHERE is_current",
    "model_certificates": "SELECT model_id, certificate_id FROM model_certificates",
    "engineers": "SELECT e.*, c.short_name AS company_short_name FROM engineers e LEFT JOIN companies c ON c.id = e.company_id",
    "companies": "SELECT * FROM companies",
    "projects": "SELECT * FROM projects",
    "project_files": "SELECT * FROM project_files",
    "project_equipment": "SELECT pe.*, k.code AS category_code, b.name AS brand_name FROM project_equipment pe "
                         "LEFT JOIN equipment_categories k ON k.id = pe.category_id LEFT JOIN equipment_brands b ON b.id = pe.brand_id",
    "equipment_categories": "SELECT code, name, drive_type FROM equipment_categories",
    "takip": "SELECT * FROM takip_projeler ORDER BY proje_no DESC, created_at ASC LIMIT 5000",
    "takip_docs": "SELECT * FROM takip_dokumanlar LIMIT 20000",
    "takip_muhasebe": "SELECT * FROM takip_muhasebe LIMIT 5000",
    "takip_counter": "SELECT next_no FROM takip_counter WHERE id = 1",
    "profiles": "SELECT p.*, u.email, u.last_sign_in_at FROM profiles p JOIN auth.users u ON u.id = p.id",
    "pending_changes_exists": "SELECT to_regclass('public.pending_changes') IS NOT NULL AS ok",
}


def load_old_global():
    sql = "SELECT json_build_object(" + ", ".join(f"'{k}', {agg(v)}" for k, v in SR_QUERIES.items()) + ")"
    return old_json(sql)


def load_old_user(uid):
    sql = "SELECT json_build_object(" + ", ".join(f"'{k}', {agg(v)}" for k, v in USER_QUERIES.items()) + ")"
    return old_json(sql, "authenticated", uid)


# ---------------------------------------------------------------- new side

def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def session(secret, uid):
    """The backend's own session format (TokenService): HS256, sub + tv, issuer/audience gensis-td."""
    now = int(dt.datetime.now(dt.timezone.utc).timestamp())
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps({"sub": uid, "tv": 0, "iss": "gensis-td", "aud": "gensis-td", "nbf": now, "exp": now + 3600}).encode())
    sig = b64(hmac.new(secret.encode(), f"{head}.{body}".encode(), hashlib.sha256).digest())
    return f"{head}.{body}.{sig}"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def api(token, path):
    """(status, json or None, location)."""
    req = urllib.request.Request(API + path, headers={"Authorization": f"Bearer {token}"} if token else {})
    try:
        with _opener.open(req, timeout=30) as r:
            status, body, loc = r.status, r.read(), r.headers.get("Location")
    except urllib.error.HTTPError as e:
        status, body, loc = e.code, e.read(), e.headers.get("Location")
    try:
        data = json.loads(body) if body else None
    except ValueError:
        data = None
    return status, data, loc


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


# ---------------------------------------------------------------- findings

class Report:
    def __init__(self):
        self.items = defaultdict(lambda: {"users": [], "examples": []})
        self.checked = defaultdict(int)  # check → comparisons made

    def ok(self, check):
        self.checked[check] += 1

    def add(self, check, kind, user, example):
        self.checked[check] += 1
        it = self.items[(check, kind, user["role"])]
        it["users"].append(user["label"])
        if len(it["examples"]) < 3:
            it["examples"].append({"user": user["label"], **example})


R = Report()


def keyed(rows, key):
    return {tuple(r.get(k) for k in key) if isinstance(key, tuple) else r.get(key): r for r in rows}


def cmp_rows(check, user, old_rows, new_rows, key="id", fields=None, order=False):
    """Row sets by key; field values on shared keys (fields=None: the columns both sides have)."""
    old_rows, new_rows = norm(old_rows), norm(new_rows)
    o, n = keyed(old_rows, key), keyed(new_rows, key)
    same = True
    missing, extra = [k for k in o if k not in n], [k for k in n if k not in o]
    if missing:
        same = False
        R.add(check, "eski tarafta var, yenide yok", user, {"count": len(missing), "keys": [str(k) for k in missing[:5]]})
    if extra:
        same = False
        R.add(check, "yenide var, eski tarafta yok", user, {"count": len(extra), "keys": [str(k) for k in extra[:5]]})
    diffs = defaultdict(list)
    for k in o.keys() & n.keys():
        cols = fields or (o[k].keys() & n[k].keys())
        for c in cols:
            if o[k].get(c) != n[k].get(c):
                diffs[c].append({"key": str(k), "old": o[k].get(c), "new": n[k].get(c)})
    for c, d in sorted(diffs.items()):
        same = False
        R.add(check, f"alan farkı: {c}", user, {"count": len(d), "first": d[0]})
    if order:
        oo = [k for k in keyed(old_rows, key) if k in n]
        nn = [k for k in keyed(new_rows, key) if k in o]
        if oo != nn:
            same = False
            i = next(i for i, (a, b) in enumerate(zip(oo, nn)) if a != b)

            def label(k):
                r = o[k]
                return str(r.get("name") or r.get("short_name") or k)
            R.add(check, "sıra farkı", user, {"from": i, "old": [label(k) for k in oo[i:i + 4]],
                                               "new": [label(k) for k in nn[i:i + 4]]})
    if same:
        R.ok(check)


def cmp_value(check, user, old, new):
    old, new = norm(old), norm(new)
    if old == new:
        R.ok(check)
        return
    if isinstance(old, dict) and isinstance(new, dict):
        for k in sorted(old.keys() | new.keys()):
            if old.get(k) != new.get(k):
                R.add(check, f"alan farkı: {k}", user, {"old": old.get(k), "new": new.get(k)})
    else:
        R.add(check, "değer farkı", user, {"old": old, "new": new})


def cmp_access(check, user, old_allowed, status):
    """old_allowed: True/False; new: 2xx/3xx = allowed, 401/403/404 = denied."""
    new_allowed = status < 400
    if old_allowed == new_allowed:
        R.ok(check)
    else:
        R.add(check, "erişim farkı", user, {"old": "izin" if old_allowed else "yok", "new": status})


# ---------------------------------------------------------------- checks

def utc_today():
    return dt.datetime.now(dt.timezone.utc).date()


def check_user(user, token, g, files_sampled):
    uid, role, cid = user["id"], user["role"], user["company_id"]
    staff, office = role in STAFF, role in OFFICE
    o = load_old_user(uid)

    def get(path):
        return api(token, path)

    # identity
    st, me, _ = get("/api/auth/me")
    cmp_value("oturum: rol/firma/ad", user, o["me"][0] if o["me"] else None,
              {k: me.get(k) for k in ("fullName", "role", "companyId")} if me else st)

    # panel: list + stats (live derived ada/parsel and seri no from input_data in the page)
    old_list = []
    for p in o["projects_list"]:
        inp = p.pop("input_data") or {}
        p["ada_parsel"] = " / ".join(x for x in (inp.get("ada"), inp.get("parsel")) if x)
        p["seri_no"] = inp.get("asansor_seri_no") or ""
        old_list.append(p)
    st, new_list, _ = get("/api/projects?limit=100")
    cmp_rows("panel: teknik dosya listesi", user, old_list, new_list or [], order=True)
    month_start = dt.datetime.now(dt.timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    vis = o["projects"]
    old_stats = {"total": len(vis), "draft": sum(p["status"] == "draft" for p in vis),
                 "delivered": sum(p["status"] == "delivered" for p in vis),
                 "this_month": sum(norm(p["created_at"]) >= norm(month_start.isoformat()) for p in vis)}
    cmp_value("panel: sayaçlar", user, old_stats, get("/api/projects/stats")[1])

    # project access matrix and per-project reads
    visible = {p["id"]: p for p in vis}
    ctx = {r["id"]: r["ctx"] for r in o["render_context"]}
    for p in g["projects"]:
        pid = p["id"]
        st, detail, _ = get(f"/api/projects/{pid}")
        cmp_access("proje erişimi (detay)", user, pid in visible, st)
        if pid not in visible or st != 200:
            continue
        cmp_rows("proje detayı", user, [visible[pid]], [detail])
        cmp_rows("proje ekipmanı", user, [e for e in o["project_equipment"] if e["project_id"] == pid],
                 get(f"/api/projects/{pid}/equipment")[1] or [], key=("category_id", "slot"))
        cmp_rows("proje dosyaları", user, [f for f in o["project_files"] if f["project_id"] == pid],
                 get(f"/api/projects/{pid}/files")[1] or [])
        cmp_value("render context (PDF girdisi)", user, ctx.get(pid), get(f"/api/projects/{pid}/render-context")[1])
        check_pdf_source(user, get(f"/api/projects/{pid}/pdf-source")[1], pid, ctx.get(pid), g)
        # live edit page: SR takip row by td_no, then its cariye_islendi
        linked = next((t for t in g["takip"] if p.get("td_no") and t["td_no"] == p["td_no"]), None)
        posted = bool(linked and any(m["takip_id"] == linked["id"] and m["cariye_islendi"] for m in g["takip_muhasebe"]))
        cmp_value("proje → muhasebe bağı", user, {"sent": linked is not None, "posted": posted},
                  get(f"/api/projects/{pid}/muhasebe")[1])

    # wizard catalogs (live: USER client, RLS)
    cmp_rows("katalog: firmalar", user, o["companies"], get("/api/catalog/companies")[1] or [], order=True)
    st, eng, _ = get("/api/catalog/engineers")
    eng = eng or {"engineers": [], "gensisCompanyId": None}
    cmp_rows("katalog: mühendisler (ham liste)", user, o["engineers"], eng["engineers"])
    check_engineer_choice(user, o, eng, g)
    cmp_rows("katalog: mühendis belgeleri", user, o["engineer_documents"], get("/api/catalog/engineer-documents")[1] or [])
    cmp_rows("katalog: firma belgeleri", user, o["company_documents"], get("/api/catalog/company-documents")[1] or [])
    st, eq, _ = get("/api/catalog/equipment")
    eq = eq or {}
    cmp_rows("katalog: ekipman kategorileri", user, o["equipment_categories"], eq.get("categories", []), order=True)
    cmp_rows("katalog: ekipman markaları", user, o["equipment_brands"], eq.get("brands", []))
    cmp_rows("katalog: ekipman modelleri", user, o["equipment_models"], eq.get("models", []))
    if staff:  # only the equipment admin page read it (service role); the table has no RLS policy
        cmp_rows("katalog: model sertifikaları", user, g["model_certificates"], eq.get("modelCertificates", []),
                 key=("model_id", "certificate_id"))
    cmp_rows("katalog: sertifikalar", user, o["certificates"], get("/api/catalog/certificates")[1] or [])
    cmp_rows("katalog: onaylanmış kuruluşlar", user, o["notified_bodies"], get("/api/catalog/notified-bodies")[1] or [])
    cmp_rows("katalog: iller", user, o["provinces"], get("/api/catalog/provinces")[1] or [], order=True)
    cmp_rows("katalog: ilgili idareler", user, o["ilgili_idareler"], get("/api/catalog/ilgili-idareler")[1] or [])
    cmp_rows("katalog: kapasite tablosu", user, o["capacity"], get("/api/catalog/capacity")[1] or [],
             key="beyan_yuku_kg", order=True)
    cmp_rows("katalog: seçim listeleri", user, o["lookups"], get("/api/catalog/lookups")[1] or [], key=("list_key", "value"))
    if user.get("districts"):
        for prov in o["provinces"]:
            cmp_rows("katalog: ilçeler", user, [d for d in o["districts"] if d["province_id"] == prov["id"]],
                     get(f"/api/catalog/provinces/{prov['id']}/districts")[1] or [], fields=("id", "name"), order=True)

    # proje onay
    cmp_rows("proje onay listesi", user, o["proje_onay_list"], get("/api/proje-onay?limit=300")[1] or [], order=True)
    pov = {r["id"]: r for r in o["proje_onay"]}
    for r in g["proje_onay_ids"]:
        st, d, _ = get(f"/api/proje-onay/{r}")
        cmp_access("proje onay erişimi", user, r in pov, st)
        if r in pov and st == 200:
            cmp_rows("proje onay detayı", user, [pov[r]], [d])

    # notes, notifications, counters (live: SR + page filter, UTC dates)
    cmp_rows("notlar", user, o["notes"], get("/api/notes")[1] or [], order=True)
    check_notifications(user, get("/api/notifications")[1], get("/api/me/counters")[1], g)

    # role-gated pages: live layout redirect vs API status
    gates = [("/api/takip", office), ("/api/muhasebe", role in ("admin", "muhasebeci", "gensis")),
             ("/api/users", role == "admin"), ("/api/pending-changes", staff),
             ("/api/engineers", True), ("/api/catalog/companies/names", True)]
    for path, allowed in gates:
        cmp_access(f"sayfa erişimi {path}", user, allowed, get(path)[0])

    if office:
        check_takip(user, get, g)
    if role == "admin":
        users = [{**p, "company_short_name": next((c["short_name"] for c in g["companies"] if c["id"] == p["company_id"]), None)}
                 for p in g["profiles"]]
        cmp_rows("kullanıcılar (admin)", user, users, get("/api/users")[1] or [],
                 fields=("email", "full_name", "role", "is_active", "company_id", "company_short_name", "last_sign_in_at"))
    if staff:
        cmp_rows("mühendisler (yönetim)", user, g["engineers"], get("/api/engineers")[1] or [],
                 fields=("full_name", "discipline", "chamber_reg_no", "company_id", "address", "phone", "company_short_name"))
        cmp_rows("mühendis belgeleri (yönetim)", user, g["engineer_documents"], get("/api/engineers/documents")[1] or [],
                 fields=("engineer_id", "doc_type", "original_name", "valid_until"))
        if g["pending_changes_exists"][0]["ok"]:
            pass  # not on live at copy time; the new list must then be empty
        else:
            st, pc, _ = get("/api/pending-changes")
            cmp_value("onay bekleyenler", user, [], pc)
    if role == "customer":
        own = [c for c in g["companies"] if c["id"] == cid]
        cmp_rows("firmam", user, own, [get(f"/api/catalog/companies/{cid}")[1] or {}],
                 fields=("short_name", "legal_name", "address", "phone", "mobile_phone", "email", "city",
                         "authorized_person", "registered_brand", "industry_reg_no", "ce_module"))
        cmp_rows("mühendislerim", user, [e for e in g["engineers"] if e["company_id"] == cid],
                 [e for e in (get("/api/engineers")[1] or []) if e.get("companyId") == cid],
                 fields=("full_name", "discipline", "chamber_reg_no", "company_id", "address", "phone", "company_short_name"))
        own_eng = {e["id"] for e in g["engineers"] if e["company_id"] == cid}
        cmp_rows("mühendislerim: belgeler", user, [d for d in g["engineer_documents"] if d["engineer_id"] in own_eng],
                 [d for d in (get("/api/engineers/documents")[1] or []) if d.get("engineerId") in own_eng],
                 fields=("engineer_id", "doc_type", "original_name", "valid_until"))

    check_files(user, token, visible, g, files_sampled)


def check_engineer_choice(user, o, eng, g):
    """Wizard: options = discipline and (Gensis or the selected company); default = first Gensis engineer."""
    gid_old = next((c["id"] for c in sorted(o["companies"], key=lambda c: c["short_name"] or "")
                    if "gensis" in tr_lower(c["short_name"] or "")), None)
    gid_new = eng.get("gensisCompanyId")
    cmp_value("mühendis seçimi: Gensis firması", user, gid_old, gid_new)
    companies = [user["company_id"]] if user["role"] == "customer" else [c["id"] for c in g["companies"]]
    old_e = sorted(o["engineers"], key=lambda e: e["full_name"] or "")
    new_e = eng.get("engineers", [])
    for comp in companies:
        for disc in ("makine", "elektrik"):
            ol = [e["id"] for e in old_e if e["discipline"] == disc and e["company_id"] in (gid_old, comp)]
            nl = [e["id"] for e in new_e if e["discipline"] == disc and e["companyId"] in (gid_new, comp)]
            cmp_value(f"mühendis seçimi: {disc} seçenekleri", user, sorted(ol), sorted(nl))
            od = next((e["id"] for e in old_e if e["discipline"] == disc and e["company_id"] == gid_old), None)
            nd = next((e["id"] for e in new_e if e["discipline"] == disc and e["companyId"] == gid_new), None)
            cmp_value(f"mühendis seçimi: {disc} varsayılan", user, od, nd)


def tr_lower(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


def check_pdf_source(user, src, pid, old_ctx, g):
    if not src:
        R.add("PDF kaynakları", "yanıt yok", user, {"project": pid})
        return
    cmp_value("PDF kaynakları: context", user, old_ctx, src.get("context"))
    p = next(x for x in g["projects"] if x["id"] == pid)
    cmp_value("PDF kaynakları: proje", user,
              {k: p[k] for k in ("makine_muhendis_id", "elektrik_muhendis_id", "company_id", "input_data", "bina_adi", "td_no")},
              src.get("project"))
    c = next((x for x in g["companies"] if x["id"] == p["company_id"]), None)
    cmp_value("PDF kaynakları: firma iletişim", user,
              c and {k: c[k] for k in ("phone", "mobile_phone", "email")}, src.get("company"))
    cmp_rows("PDF kaynakları: proje dosyaları", user,
             [{"kind": f["kind"], "path": f["storage_path"], "sort_order": f["sort_order"]}
              for f in g["project_files"] if f["project_id"] == pid and f["storage_path"]],
             src.get("projectFiles", []), key="path")
    eng_ids = {p["makine_muhendis_id"], p["elektrik_muhendis_id"]} - {None}
    cmp_rows("PDF kaynakları: mühendis belgeleri", user,
             [{"engineer_id": d["engineer_id"], "doc_type": d["doc_type"], "path": d["storage_path"]}
              for d in g["engineer_documents"] if d["engineer_id"] in eng_ids and d["storage_path"]],
             src.get("engineerDocs", []), key=("engineer_id", "doc_type", "path"))
    cmp_rows("PDF kaynakları: firma belgeleri", user,
             [{"id": d["id"], "doc_type": d["doc_type"], "path": d["storage_path"], "belge_no": d["belge_no"],
               "issue_date": d["issue_date"], "notified_body_id": d["notified_body_id"]}
              for d in g["company_documents"] if d["company_id"] == p["company_id"]],
             src.get("companyDocs", []))
    eq = [e for e in g["project_equipment"] if e["project_id"] == pid]
    cmp_rows("PDF kaynakları: ekipman", user,
             [{k: e[k] for k in ("slot", "category_code", "brand_name", "certificate_id", "seri_list")} for e in eq],
             src.get("equipment", []), key=("category_code", "slot"))
    cert_ids = {e["certificate_id"] for e in eq} - {None}
    cmp_rows("PDF kaynakları: sertifika dosyaları", user,
             [{"certificate_id": f["certificate_id"], "path": f["storage_path"]}
              for f in g["certificate_files"] if f["certificate_id"] in cert_ids],
             src.get("certificateFiles", []), key="certificate_id")
    cmp_rows("PDF kaynakları: ekipman kategorileri", user, g["equipment_categories"],
             src.get("equipmentCategories", []), key="code")


def check_notifications(user, notif, counters, g):
    role, cid = user["role"], user["company_id"]
    staff = role in STAFF
    cutoff = (utc_today() + dt.timedelta(days=30)).isoformat()
    cdocs = sorted([d for d in g["company_documents"] if d["valid_until"] and d["valid_until"] <= cutoff
                    and (staff or d["company_id"] == (cid or ZERO))], key=lambda d: d["valid_until"])
    edocs = sorted([d for d in g["engineer_documents"] if d["valid_until"] and d["valid_until"] <= cutoff
                    and (staff or d["company_id"] == cid)], key=lambda d: d["valid_until"])
    certs = sorted([c for c in g["certificates"] if c["valid_until"] and c["valid_until"] <= cutoff], key=lambda c: c["valid_until"]) \
        if staff else []
    notif = notif or {}
    cmp_rows("bildirimler: firma belgeleri", user,
             [{"id": d["id"], "company_id": d["company_id"], "firma": d["short_name"], "doc_type": d["doc_type"],
               "belge_no": d["belge_no"], "valid_until": d["valid_until"]} for d in cdocs], notif.get("musteri", []))
    cmp_rows("bildirimler: mühendis belgeleri", user,
             [{"id": d["id"], "engineer_id": d["engineer_id"], "doc_type": d["doc_type"], "valid_until": d["valid_until"]}
              for d in edocs], notif.get("muhendis", []), fields=("engineer_id", "doc_type", "valid_until"))
    cmp_rows("bildirimler: ekipman sertifikaları", user,
             [{"id": c["id"], "cert_no": c["cert_no"], "valid_until": c["valid_until"]} for c in certs],
             notif.get("ekipman", []), fields=("cert_no", "valid_until"))
    today = utc_today().isoformat()
    takip = sum(1 for t in g["takip"] if t["proje_sorumlusu_id"] == user["id"] and t["durum"] != "TAMAMLANDI"
                and t["tahmini_tamamlanma"] and t["tahmini_tamamlanma"] <= today) if staff else 0
    muh = sum(1 for t in g["takip"] if t["muhasebeye_gonderildi"] and t["muhasebe_durumu"] != "tamamlandi") \
        if role in ("admin", "muhasebeci") else 0
    cmp_value("menü sayaçları", user,
              {"bildirim": len(cdocs) + len(edocs) + len(certs), "onay": 0, "takip": takip, "muhasebe": muh}, counters)


def takip_old_rows(g):
    """Live list page first moved overdue HAZIRLANIYOR jobs to BEKLIYOR (UTC date), then read."""
    today = utc_today().isoformat()
    rows = []
    for t in g["takip"]:
        t = dict(t)
        if t["durum"] == "HAZIRLANIYOR" and t["tahmini_tamamlanma"] and t["tahmini_tamamlanma"] < today:
            t["durum"] = "BEKLIYOR"
        rows.append(t)
    return rows


def check_takip(user, get, g):
    rows = takip_old_rows(g)
    st, new, _ = get("/api/takip")
    new = new or []
    cmp_rows("proje takip listesi", user, [t for t in rows if not t["td_no"]], [x["row"] for x in new],
             fields=None, order=True)
    docs_new = [d for x in new for d in x.get("docs", [])]
    ids = {t["id"] for t in rows if not t["td_no"]}
    cmp_rows("proje takip: dokümanlar", user, [d for d in g["takip_docs"] if d["takip_id"] in ids], docs_new,
             fields=("takip_id", "kind", "original_name", "created_at"))
    cmp_rows("proje takip: muhasebe durumu", user,
             [{"takip_id": m["takip_id"], "cariye_islendi": m["cariye_islendi"], "teslim_tarihi": m["teslim_tarihi"]}
              for m in g["takip_muhasebe"] if m["takip_id"] in ids],
             [{"takipId": x["row"]["id"], **x["muhasebe"]} for x in new if x.get("muhasebe")], key="takip_id")
    st, muh, _ = get("/api/muhasebe")
    if st == 200:
        cmp_rows("muhasebe listesi", user, rows, [x["row"] for x in muh or []], order=True)
        cmp_rows("muhasebe kayıtları", user, g["takip_muhasebe"], [x["muhasebe"] for x in muh or [] if x.get("muhasebe")],
                 key="takip_id")
    sorumlu = sorted([p for p in g["profiles"] if p["role"] in STAFF], key=lambda p: p["full_name"] or "")
    cmp_rows("proje takip: sorumlular", user, [{k: p[k] for k in ("id", "full_name", "role")} for p in sorumlu],
             get("/api/takip/sorumlular")[1] or [])
    cmp_value("proje takip: sıradaki no", user, {"next_no": g["takip_counter"][0]["next_no"]}, get("/api/takip/next-no")[1])
    cmp_rows("firma adları (ofis)", user,
             [{k: c[k] for k in ("id", "short_name", "legal_name", "city", "category")} for c in g["companies"]],
             get("/api/catalog/companies/names")[1] or [])


def check_files(user, token, visible, g, sampled):
    """Download matrix: live /api/belge/* rules vs new /api/files/* (302 = allowed)."""
    role, cid = user["role"], user["company_id"]
    staff = role in STAFF
    eng_company = {e["id"]: e["company_id"] for e in g["engineers"]}
    cases = []
    for f in g["project_files"]:
        cases.append(("proje", f"/api/files/project/{f['id']}", bool(f["storage_path"]) and f["project_id"] in visible, f))
    for d in sampled["company_documents"](cid):
        cases.append(("firma belgesi", f"/api/files/company/{d['id']}",
                      bool(d["storage_path"]) and (staff or cid == d["company_id"]), d))
    for d in g["engineer_documents"]:
        cases.append(("mühendis belgesi", f"/api/files/engineer/{d['id']}",
                      bool(d["storage_path"]) and (staff or (cid is not None and eng_company.get(d["engineer_id"]) == cid)), d))
    for c in sampled["certificates"]:
        cases.append(("sertifika", f"/api/files/certificate/{c['certificate_id']}", True, c))
    for d in g["takip_docs"]:
        cases.append(("takip dokümanı", f"/api/files/takip/{d['id']}", role in OFFICE and bool(d["storage_path"]), d))
    for kind, path, allowed, _ in cases:
        st, _, loc = api(token, path)
        cmp_access(f"dosya erişimi: {kind}", user, allowed, st)
        if st < 400 and st not in (301, 302, 303, 307):
            R.add(f"dosya erişimi: {kind}", "yönlendirme yok", user, {"status": st})


def check_file_bytes(token, copy, g):
    """Every stored file: the new side serves the same bytes as the copy (migration integrity)."""
    admin = {"label": "admin (dosya bütünlüğü)", "role": "admin"}
    jobs = [(f"/api/files/project/{f['id']}", "documents", f["storage_path"]) for f in g["project_files"] if f["storage_path"]]
    jobs += [(f"/api/files/company/{d['id']}", "documents", d["storage_path"]) for d in g["company_documents"] if d["storage_path"]]
    jobs += [(f"/api/files/engineer/{d['id']}", "documents", d["storage_path"]) for d in g["engineer_documents"] if d["storage_path"]]
    jobs += [(f"/api/files/certificate/{f['certificate_id']}", "certificates", f["storage_path"]) for f in g["certificate_files"]]
    jobs += [(f"/api/files/takip/{d['id']}", "documents", d["storage_path"]) for d in g["takip_docs"] if d["storage_path"]]
    for path, bucket, key in jobs:
        local = os.path.join(copy, "storage", bucket, key)
        if not os.path.exists(local):
            R.add("dosya bütünlüğü", "kopyada dosya yok (canlıda da kayıp olabilir)", admin, {"path": f"{bucket}/{key}"})
            continue
        st, _, loc = api(token, path)
        if not loc:
            R.add("dosya bütünlüğü", "indirilemedi", admin, {"path": f"{bucket}/{key}", "status": st})
            continue
        with open(local, "rb") as fh:
            same = hashlib.sha256(fetch(loc)).digest() == hashlib.sha256(fh.read()).digest()
        if same:
            R.ok("dosya bütünlüğü")
        else:
            R.add("dosya bütünlüğü", "içerik farklı", admin, {"path": f"{bucket}/{key}"})


def check_migration(copy):
    """User decision (ADR-004): all live data moves as it is (prova.compare)."""
    who = {"label": "taşıma", "role": "taşıma"}
    for check, kind, detail in prova.compare(copy, prova.rehearsal(copy)):
        if kind is None:
            R.ok(f"taşıma: {check}")
        else:
            R.add(f"taşıma: {check}", kind, who, detail)


# ---------------------------------------------------------------- known, intended differences

# (check prefix, kind prefix, roles or None, reason). Matched items go to the "bilinçli farklar" list for the
# user's approval; everything else is a difference to fix. Keep reasons short; the plan is in PM-Talepleri.
KNOWN = [
    ("katalog: firmalar", "eski tarafta var", ("customer",), "KRR-014: müşteri yalnız kendi firmasını görür"),
    ("sayfa erişimi /api/catalog/companies/names", "erişim farkı", ("customer",),
     "KRR-014: firma adları listesi yalnız ofis rollerine; müşteri ekranları kullanmıyor"),
    ("katalog: mühendisler", "eski tarafta var", ("customer",),
     "KRR-014/023: müşteri kendi firması + Gensis mühendislerini görür"),
    ("proje → muhasebe bağı", "alan farkı", None,
     "KRR-013: projenin takip satırı yalnız aynı firma ya da firmasız satır. Tetikleyen TD-26-0001 deneme kaydı "
     "(kullanıcı 2026-10-21)"),
    ("katalog: firmalar", "sıra farkı", None, "Türkçe sıralama (tr-x-icu); canlı en_US.UTF-8 (datcollate, 2026-10-22)"),
    ("katalog: iller", "sıra farkı", None, "Türkçe sıralama (tr-x-icu); canlı en_US.UTF-8 (datcollate, 2026-10-22)"),
    ("katalog: ilçeler", "sıra farkı", None, "Türkçe sıralama (tr-x-icu); canlı en_US.UTF-8 (datcollate, 2026-10-22)"),
]

# Intended differences on write paths and edge cases the read-only replay cannot show (PM-Talepleri plan, item 5).
WRITE_PATH_INTENDED = [
    "Güvenlik düzeltmeleri KRR-011/013/014/020/021/022/023 (başka firmanın kaydına yazma/okuma kapalı)",
    "Mühendis kuralı personele de uygulanıyor (proje mühendisi = projenin firması ya da Gensis)",
    "Silinen TD No ve takip proje no tekrar verilmiyor",
    "Otomatik BEKLIYOR ve tarih sınırları Türkiye tarihine göre (canlı UTC); 00:00–03:00 arası bir gün fark eder",
    "PDF uçları oturumsuz istekte 401/404",
    "Müşterinin firma/mühendis değişikliği onaya düşüyor",
    "Şifre sıfırlama yöneticide (e-postalı akış ayrı iş)",
]


def classify(check, kind, role):
    for c, k, roles, reason in KNOWN:
        if check.startswith(c) and kind.startswith(k) and (roles is None or role in roles):
            return reason
    return None


# ---------------------------------------------------------------- main

def main():
    global API
    args = sys.argv[1:]
    remote = None
    if len(args) == 3 and args[1] == "--api":
        remote = args[2].rstrip("/")
    elif len(args) != 1:
        raise SystemExit(__doc__)
    copy = os.path.abspath(args[0])
    if remote:
        API = remote
        secret = os.environ.get("GTD_JWT_SECRET") or ""
        if len(secret) < 32:
            raise SystemExit("GTD_JWT_SECRET is not set (the target backend's Auth__JwtSecret)")
    else:
        secret = prova.read_env(copy)["JWT_SECRET"]
    g = load_old_global()
    g["proje_onay_ids"] = [r["id"] for r in old_json(agg("SELECT id FROM proje_onay"))]
    profiles = sorted(g["profiles"], key=lambda p: (p["role"], p["email"]))

    # Same deterministic sample for every customer: own company's documents + the first five of others.
    def company_docs_for(cid):
        own = [d for d in g["company_documents"] if d["company_id"] == cid]
        others = sorted((d for d in g["company_documents"] if d["company_id"] != cid), key=lambda d: d["id"])[:5]
        return own + others
    sampled = {"company_documents": company_docs_for,
               "certificates": sorted(g["certificate_files"], key=lambda f: f["certificate_id"])[:10]}

    if not remote:
        check_migration(copy)  # first: the new side's takip list moves overdue jobs to BEKLIYOR when read

    seen_roles = set()
    for p in profiles:
        label = p["role"] if p["role"] != "customer" else f"müşteri · {p['company_id'][:8]}"
        user = {"id": p["id"], "role": p["role"], "company_id": p["company_id"],
                "label": f"{label} · {p['id'][:8]}", "districts": p["role"] not in seen_roles}
        seen_roles.add(p["role"])
        if not p["is_active"]:
            continue
        check_user(user, session(secret, p["id"]), g, sampled)
        print(".", end="", flush=True)
    print()

    # anonymous: live pages redirected to /giris, the API answers 401
    anon = {"id": None, "role": "anon", "company_id": None, "label": "oturumsuz"}
    for path in ("/api/projects", "/api/catalog/companies", "/api/takip", f"/api/projects/{g['projects'][0]['id']}/pdf-source"):
        cmp_access(f"oturumsuz erişim {path.split('/')[2]}", anon, False, api(None, path)[0])

    admin_id = next(p["id"] for p in profiles if p["role"] == "admin" and p["is_active"])
    check_file_bytes(session(secret, admin_id), copy, g)
    loc = prova.old_locale(copy)
    write_report(copy, profiles, {"locale": loc or "en_US.utf8 (varsayım; canlı değeri kopyada yok)",
                                  "pending": g["pending_changes_exists"][0]["ok"], "api": API, "remote": bool(remote)})


def write_report(copy, profiles, notes):
    now = dt.datetime.now()
    known, diffs = [], []
    for (check, kind, role), it in sorted(R.items.items()):
        entry = {"check": check, "kind": kind, "role": role, "users": len(it["users"]), "examples": it["examples"]}
        reason = classify(check, kind, role)
        (known if reason else diffs).append({**entry, "reason": reason} if reason else entry)
    roles = defaultdict(int)
    for p in profiles:
        roles[p["role"]] += 1
    out_dir = os.path.join(copy, "rapor")
    os.umask(0o077)  # the report holds personal data, like the copy
    os.makedirs(out_dir, mode=0o700, exist_ok=True)
    base = os.path.join(out_dir, f"esdegerlik-{now:%Y%m%d-%H%M}")
    with open(base + ".json", "w") as f:
        json.dump({"at": now.isoformat(), "roles": roles, "checked": R.checked, "differences": diffs, "intended": known},
                  f, ensure_ascii=False, indent=1, default=str)
    lines = [f"# Eşdeğerlik raporu — {now:%Y-%m-%d %H:%M}", "",
             f"Yeni taraf: {notes['api']}" + (" (taşıma kontrolü: server'da `migrate.py verify`)" if notes["remote"] else ""),
             f"Kopya: `{copy}` · kullanıcılar: " + ", ".join(f"{k} {v}" for k, v in sorted(roles.items())),
             f"Karşılaştırma: {sum(R.checked.values())} · fark: {len(diffs)} madde · bilinçli fark: {len(known)} madde", "",
             "## Fark listesi (düzeltilecek ya da karara bağlanacak)", ""]
    for d in diffs:
        lines.append(f"- **{d['check']}** — {d['kind']} · {d['role']} · {d['users']} kullanıcı")
        for e in d["examples"][:2]:
            lines.append(f"    - `{json.dumps(e, ensure_ascii=False, default=str)[:400]}`")
    lines += ["", "## Bilinçli farklar (kullanıcı onayı)", "", "Bu koşuda görülenler:", ""]
    for d in known:
        lines.append(f"- **{d['check']}** — {d['kind']} · {d['role']} · {d['users']} kullanıcı — {d['reason']}")
    lines += ["", "Yazma yolları ve bu verinin göstermediği durumlar (plan):", ""] + [f"- {x}" for x in WRITE_PATH_INTENDED]
    lines += ["", "## Kapsam notları", "",
              ("- Canlıda müşteri hesabı yok; bu koşuda prova müşterisi yok (müşteri erişimi yerel provada ve "
               "entegrasyon testlerinde)." if notes["remote"] else
               "- Canlıda müşteri hesabı yok: her firma için prova'ya özel bir müşteri eklendi (iki tarafta aynı)."),
              "- Okumalar karşılaştırıldı; yazma uçları birim/e2e testlerinde.",
              "- Taşıma: public tablolar olduğu gibi; auth.users'tan id, e-posta, parola hash'i ve tarihler. Taşınmayan "
              "Supabase iç alanları: onay/kurtarma token'ları, `raw_user_meta_data` (full_name profilde aynı, email_verified).",
              f"- Eski tarafın collation'ı: {notes['locale']}.",
              f"- Canlıda `pending_changes` tablosu {'var' if notes['pending'] else 'yok (canlı /onaylar sayfası bu tabloyu okuyordu)'}."]
    lines += ["", "## Kontrol sayıları", ""] + [f"- {k}: {v}" for k, v in sorted(R.checked.items())]
    with open(base + ".md", "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{base}.md — fark {len(diffs)}, bilinçli {len(known)}")
    sys.exit(1 if diffs else 0)


if __name__ == "__main__":
    main()
