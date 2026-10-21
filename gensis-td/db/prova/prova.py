"""Rehearsal environment for the Supabase → server01 data migration and the equivalence run.

Works from a read-only copy of live (`<copy>/public.dump`, `<copy>/auth_storage_data.dump`, `<copy>/storage/<bucket>/...`)
and never connects to live Supabase.

  old side  container `gtd-prova-old`: Postgres 17 (glibc, as Supabase) on tmpfs, no network, Supabase stub
            (supabase_stub.sql) + the full public dump (RLS policies included). Queried as a user with
            SET ROLE authenticated + request.jwt.claims. Collation: `<copy>/locale.txt` (live's datcollate, one line)
            when the copy has it, else en_US.utf8; it decides the order of unsorted-by-the-app lists.
  new side  compose project `gensis-td-prova` from this repo's docker-compose.yml (db, storage, migrate, backend),
            loaded the way the real migration will be: auth.users → users, public data-only, storage files → MinIO.
            Backend on 127.0.0.1:10212, storage on 127.0.0.1:10213.

Throwaway secrets go to `<copy>/prova.env` (outside git, the copy folder is go-rwx).

Usage (python3 -I prova.py ...):
  up <copy>          build both sides (fails if they already exist; run down first)
  gensis-id <copy>   live's Gensis company rule on the copy, plus the engineers it yields
  down <copy>        remove both sides with their data and prova.env
"""
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(os.path.dirname(HERE))  # gensis-td/
OLD = "gtd-prova-old"
PROJECT = "gensis-td-prova"
BACKEND_PORT = 10212
STORAGE_PORT = 10213
BUCKETS = ("documents", "certificates")
MINIO_IMAGE = "cgr.dev/chainguard/minio@sha256:32c504bea4574d8f29d719b37bc0dad920ecf3e22b81dc5cea0bb105af2ce10f"

# Live's rule (main: the wizard picks the first company whose short name contains "gensis", Turkish order).
GENSIS_SQL = """
select id, short_name from public.companies
where short_name ilike '%gensis%'
order by short_name collate "tr-x-icu", id
"""


def run(args, *, input=None, capture=False, env=None, check=True):
    res = subprocess.run(args, input=input, capture_output=capture, env=env, check=False)
    if check and res.returncode != 0:
        err = res.stderr.decode(errors="replace")[-2000:] if capture and res.stderr else ""
        raise SystemExit(f"failed ({res.returncode}): {' '.join(args[:6])} ...\n{err}")
    return res


def old_sql(sql, db="prova"):
    """Runs SQL as the old side's superuser and returns psql's unaligned output."""
    res = run(["docker", "exec", "-i", OLD, "psql", "-X", "-q", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1",
               "-At"], input=sql.encode(), capture=True)
    return res.stdout.decode()


def read_env(copy):
    env = {}
    with open(os.path.join(copy, "prova.env")) as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.rstrip("\n").split("=", 1)
                env[k] = v
    return env


def compose(copy, *args, **kw):
    return run(["docker", "compose", "-p", PROJECT, "--env-file", os.path.join(copy, "prova.env"),
                "-f", os.path.join(APP_DIR, "docker-compose.yml"), *args], **kw)


def new_psql(copy, sql):
    env = read_env(copy)
    res = compose(copy, "exec", "-T", "db", "psql", "-X", "-q", "-U", env["DB_USER"], "-d", env["DB_NAME"],
                  "-v", "ON_ERROR_STOP=1", "-At", "-c", sql, capture=True)
    return res.stdout.decode()


# ---------------------------------------------------------------- old side

def old_locale(copy):
    path = os.path.join(copy, "locale.txt")
    return open(path).read().strip() if os.path.exists(path) else None


def old_up(copy):
    pw = secrets.token_hex(16)
    locale = old_locale(copy) or "en_US.utf8"
    run(["docker", "run", "-d", "--name", OLD, "--network", "none", "--tmpfs", "/var/lib/postgresql/data",
         "-e", "POSTGRES_PASSWORD", "-e", "POSTGRES_DB=prova", "-e", f"POSTGRES_INITDB_ARGS=--locale={locale}",
         "-v", f"{copy}:/prova:ro", "postgres:17"],
        env={**os.environ, "POSTGRES_PASSWORD": pw})
    for _ in range(60):
        if run(["docker", "exec", OLD, "pg_isready", "-U", "postgres", "-d", "prova", "-h", "127.0.0.1"],
               capture=True, check=False).returncode == 0:
            break
        time.sleep(1)
    else:
        raise SystemExit("old side did not start")
    time.sleep(2)  # the image restarts Postgres once after init
    old_sql(open(os.path.join(HERE, "supabase_stub.sql")).read() + "\nDROP SCHEMA public CASCADE;")
    # auth.users first: public.profiles references it. The handle_new_user trigger does not exist yet.
    run(["docker", "exec", OLD, "pg_restore", "-U", "postgres", "-d", "prova", "--data-only", "-n", "auth",
         "-t", "users", "/prova/auth_storage_data.dump"], capture=True)
    run(["docker", "exec", OLD, "pg_restore", "-U", "postgres", "-d", "prova", "--exit-on-error",
         "/prova/public.dump"], capture=True)
    # The dump has no privileges; Supabase grants everything in public to the API roles and lets RLS decide.
    old_sql("""
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
    """)
    counts = old_sql("select count(*) || ' users, ' || (select count(*) from public.projects) || ' projects' "
                     "from auth.users").strip()
    print(f"old side ({locale}{'' if old_locale(copy) else ', assumed'}):", counts)


def gensis_id():
    rows = [line.split("|") for line in old_sql(GENSIS_SQL).splitlines() if line]
    if not rows:
        raise SystemExit("no company matches %gensis%")
    return rows


# ---------------------------------------------------------------- new side

def write_env(copy, gensis):
    env = {
        "PROXY_PORT": "10211", "BACKEND_PORT": str(BACKEND_PORT), "STORAGE_PORT": str(STORAGE_PORT),
        "DB_NAME": "gensis_td", "DB_USER": "gensis_td", "DB_PASSWORD": secrets.token_hex(24),
        "DB_APP_USER": "gensis_td_app", "DB_APP_PASSWORD": secrets.token_hex(24),
        "JWT_SECRET": secrets.token_urlsafe(48), "SECURE_COOKIE": "false",
        "MINIO_ROOT_USER": "gensis-td", "MINIO_ROOT_PASSWORD": secrets.token_hex(24),
        "MINIO_APP_USER": "gensis-td-app", "MINIO_APP_PASSWORD": secrets.token_hex(24),
        "STORAGE_PUBLIC_URL": f"http://127.0.0.1:{STORAGE_PORT}",
        "GENSIS_COMPANY_ID": gensis,
        "ADMIN_EMAIL": "", "ADMIN_PASSWORD": "",
    }
    path = os.path.join(copy, "prova.env")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write("# Throwaway secrets for the local rehearsal (db/prova/prova.py). Removed by `down`.\n")
        f.writelines(f"{k}={v}\n" for k, v in env.items())


def wait_health():
    for _ in range(90):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{BACKEND_PORT}/api/health", timeout=2) as r:
                if r.status == 200:
                    return
        except OSError:
            pass
        time.sleep(2)
    raise SystemExit("backend did not become healthy")


def new_up(copy):
    compose(copy, "up", "-d", "--build", "backend")
    wait_health()
    env = read_env(copy)
    db = ["exec", "-T", "db"]
    # users ← auth.users (bcrypt hashes as they are)
    users = run(["docker", "exec", OLD, "psql", "-X", "-U", "postgres", "-d", "prova", "-c",
                 "COPY (select id, email, coalesce(encrypted_password, ''), created_at, last_sign_in_at "
                 "from auth.users) TO STDOUT"], capture=True).stdout
    compose(copy, *db, "psql", "-X", "-q", "-U", env["DB_USER"], "-d", env["DB_NAME"], "-v", "ON_ERROR_STOP=1", "-c",
            "COPY public.users (id, email, password_hash, created_at, last_sign_in_at) FROM STDIN",
            input=users, capture=True)
    # public data as dumped; FK triggers off during the load (same rows, so nothing dangles that did not on live)
    cid = compose(copy, "ps", "-q", "db", capture=True).stdout.decode().strip()
    run(["docker", "cp", os.path.join(copy, "public.dump"), f"{cid}:/tmp/public.dump"])
    try:
        compose(copy, *db, "pg_restore", "-U", env["DB_USER"], "-d", env["DB_NAME"], "--data-only",
                "--disable-triggers", "--no-owner", "--exit-on-error", "/tmp/public.dump", capture=True)
    finally:
        compose(copy, *db, "rm", "-f", "/tmp/public.dump", check=False)
    # storage files
    net = f"{PROJECT}_default"
    script = "set -e; export MC_CONFIG_DIR=/tmp/mc; " \
             "mc alias set p http://storage:9000 \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" >/dev/null; " + \
             "; ".join(f"mc mirror --overwrite --quiet /data/{b} p/{b}" for b in BUCKETS)
    run(["docker", "run", "--rm", "--network", net, "-v", f"{copy}/storage:/data:ro", "-e", "MINIO_ROOT_USER",
         "-e", "MINIO_ROOT_PASSWORD", "--entrypoint", "/bin/bash", MINIO_IMAGE, "-c", script],
        env={**os.environ, "MINIO_ROOT_USER": env["MINIO_ROOT_USER"], "MINIO_ROOT_PASSWORD": env["MINIO_ROOT_PASSWORD"]},
        capture=True)
    print("new side:", new_psql(copy, "select (select count(*) from users) || ' users, ' || "
                                      "(select count(*) from projects) || ' projects'").strip())


# Live has no customer accounts, so each company gets one rehearsal-only customer, identical on both sides
# (deterministic id, no password: the equivalence script signs its own sessions on the new side).
CUSTOMER_PROFILES_SQL = """
INSERT INTO public.profiles (id, full_name, role, company_id, is_active)
SELECT md5('prova-customer:' || id)::uuid, 'Prova müşteri ' || short_name, 'customer', id, true FROM public.companies;
"""


def add_customers(copy):
    old_sql("INSERT INTO auth.users (id, email) SELECT md5('prova-customer:' || id)::uuid, "
            "'prova-' || id || '@prova.invalid' FROM public.companies;" + CUSTOMER_PROFILES_SQL)
    new_psql(copy, "INSERT INTO public.users (id, email, password_hash) SELECT md5('prova-customer:' || id)::uuid, "
                   "'prova-' || id || '@prova.invalid', '' FROM public.companies;" + CUSTOMER_PROFILES_SQL)
    print("rehearsal customers:", old_sql("select count(*) from profiles where role = 'customer'").strip())


def minio_objects(copy):
    """{(bucket, key): size} on the new side's MinIO."""
    env = read_env(copy)
    script = "set -e; export MC_CONFIG_DIR=/tmp/mc; " \
             "mc alias set p http://storage:9000 \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" >/dev/null; " + \
             "; ".join(f"echo '#{b}'; mc ls --recursive --json p/{b}" for b in BUCKETS)
    out = run(["docker", "run", "--rm", "--network", f"{PROJECT}_default", "-e", "MINIO_ROOT_USER",
               "-e", "MINIO_ROOT_PASSWORD", "--entrypoint", "/bin/bash", MINIO_IMAGE, "-c", script],
              env={**os.environ, "MINIO_ROOT_USER": env["MINIO_ROOT_USER"], "MINIO_ROOT_PASSWORD": env["MINIO_ROOT_PASSWORD"]},
              capture=True).stdout.decode()
    objects, bucket = {}, None
    for line in out.splitlines():
        if line.startswith("#"):
            bucket = line[1:]
        elif line.strip():
            o = json.loads(line)
            if o.get("type") == "file":
                objects[(bucket, o["key"])] = o["size"]
    return objects


def down(copy):
    run(["docker", "rm", "-fv", OLD], capture=True, check=False)
    if os.path.exists(os.path.join(copy, "prova.env")):
        compose(copy, "down", "-v", "--remove-orphans", capture=True, check=False)
        os.remove(os.path.join(copy, "prova.env"))
    print("removed")


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("up", "gensis-id", "down"):
        raise SystemExit(__doc__)
    cmd, copy = sys.argv[1], os.path.abspath(sys.argv[2])
    if cmd == "down":
        return down(copy)
    if cmd == "gensis-id":
        rows = gensis_id()
        print(json.dumps([{"id": r[0], "short_name": r[1]} for r in rows], ensure_ascii=False, indent=1))
        return
    if os.path.exists(os.path.join(copy, "prova.env")):
        raise SystemExit("prova.env exists: run down first")
    old_up(copy)
    rows = gensis_id()
    print("GENSIS_COMPANY_ID:", rows[0][0], f"({rows[0][1]}; {len(rows)} match)")
    write_env(copy, rows[0][0])
    new_up(copy)
    add_customers(copy)


if __name__ == "__main__":
    main()
