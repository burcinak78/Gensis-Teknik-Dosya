"""Read-only copy of live Supabase for the migration rehearsal (prova.py) and the cutover.

Produces the layout prova.py and equivalence.py read:
  <copy>/locale.txt               live's datcollate (one line)
  <copy>/public.dump              pg_dump -Fc of schema public (schema + data, RLS policies, no privileges)
  <copy>/auth_storage_data.dump   data only: auth.users, storage.buckets, storage.objects
  <copy>/objects.tsv              bucket <TAB> name <TAB> size, from storage.objects
  <copy>/storage/<bucket>/<name>  every object, downloaded with the service role key and checked against its size

Nothing is written to live: queries run inside BEGIN READ ONLY and pg_dump opens its own read-only transaction.
(Supabase's pooler drops PGOPTIONS, so default_transaction_read_only cannot be set at connect time.)
The copy holds personal data: the folder is created go-rwx and must be deleted after the rehearsal.

Secrets come from an env file given with --env-file (only SUPABASE_DB_URL, SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY are read) and are passed to containers through the environment, never as arguments.

Usage (python3 -I snapshot.py ...):
  check --env-file <file>          connection, collation, row and object counts; downloads nothing
  take  --env-file <file> <copy>   full copy into <copy> (must not exist or be empty)
"""
import concurrent.futures
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

BUCKETS = ("documents", "certificates")
KEYS = ("SUPABASE_DB_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
PG_IMAGE = "postgres:17"
WORKERS = 8


def read_secrets(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("export "):
                line = line[7:]
            if "=" not in line or line.startswith("#"):
                continue
            k, v = line.split("=", 1)
            if k in KEYS:
                env[k] = v.strip().strip("'\"")
    missing = [k for k in KEYS if not env.get(k)]
    if missing:
        raise SystemExit(f"missing in {path}: {', '.join(missing)}")
    return env


def pg(secrets, script, *, mount=None, input=None):
    """Runs a shell script in a throwaway Postgres client container that can reach live."""
    args = ["docker", "run", "--rm", "-i", "-e", "SUPABASE_DB_URL"]
    if mount:
        args += ["-v", f"{mount}:/out"]
    args += [PG_IMAGE, "sh", "-c", "umask 077; " + script]
    env = {**os.environ, "SUPABASE_DB_URL": secrets["SUPABASE_DB_URL"]}
    res = subprocess.run(args, env=env, input=input, capture_output=True)
    if res.returncode != 0:
        raise SystemExit(f"failed: {script[:60]} ...\n{res.stderr.decode(errors='replace')[-2000:]}")
    return res.stdout.decode()


def sql(secrets, query):
    return pg(secrets, "psql -X -q -At -F '\t' -v ON_ERROR_STOP=1 -d \"$SUPABASE_DB_URL\"",
              input=f"BEGIN READ ONLY;\n{query};\nCOMMIT;\n".encode())


def objects(secrets):
    out = sql(secrets, "select bucket_id, name, coalesce(metadata->>'size', '-1') from storage.objects "
                       "order by bucket_id, name")
    rows = [line.split("\t") for line in out.splitlines() if line]
    other = sorted({b for b, _, _ in rows} - set(BUCKETS))
    if other:
        raise SystemExit(f"objects in unexpected buckets: {', '.join(other)} (prova.py only moves {BUCKETS})")
    return [(b, n, int(s)) for b, n, s in rows]


def storage_get(secrets, path):
    req = urllib.request.Request(f"{secrets['SUPABASE_URL'].rstrip('/')}/storage/v1/{path}", headers={
        "Authorization": f"Bearer {secrets['SUPABASE_SERVICE_ROLE_KEY']}",
        "apikey": secrets["SUPABASE_SERVICE_ROLE_KEY"]})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def check(secrets):
    print(sql(secrets, "select 'server ' || current_setting('server_version') || ', read only ' || "
                       "current_setting('transaction_read_only') || ', datcollate ' || datcollate "
                       "from pg_database where datname = current_database()").strip())
    print(sql(secrets, "select (select count(*) from pg_tables where schemaname = 'public') || ' public tables, ' "
                       "|| (select count(*) from auth.users) || ' auth users, ' "
                       "|| (select count(*) from public.projects) || ' projects'").strip())
    rows = objects(secrets)
    for b in BUCKETS:
        sizes = [s for bb, _, s in rows if bb == b]
        print(f"{b}: {len(sizes)} objects, {sum(sizes) / 1e6:.1f} MB")
    storage_get(secrets, "bucket")  # the storage API accepts the service role key
    print("storage API: ok")


def download(secrets, copy, obj):
    bucket, name, size = obj
    parts = name.split("/")
    if name.startswith("/") or any(p in ("", ".", "..") for p in parts):
        return f"{bucket}/{name}: unsafe name, skipped"
    dest = os.path.join(copy, "storage", bucket, *parts)
    os.makedirs(os.path.dirname(dest), mode=0o700, exist_ok=True)
    error = None
    for _ in range(3):
        try:
            data = storage_get(secrets, f"object/authenticated/{bucket}/{urllib.parse.quote(name)}")
        except (urllib.error.URLError, TimeoutError) as e:
            error = str(e)
            continue
        if size >= 0 and len(data) != size:
            error = f"size {len(data)}, listed {size}"
            continue
        fd = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        return None
    return f"{bucket}/{name}: {error}"


def dumps(secrets, copy):
    pg(secrets, 'pg_dump -d "$SUPABASE_DB_URL" -Fc -n public --no-privileges -f /out/public.dump', mount=copy)
    pg(secrets, 'pg_dump -d "$SUPABASE_DB_URL" -Fc --data-only -t auth.users -t storage.buckets '
                '-t storage.objects -f /out/auth_storage_data.dump', mount=copy)


def take(secrets, copy):
    if os.path.exists(copy) and os.listdir(copy):
        raise SystemExit(f"{copy} is not empty")
    os.makedirs(copy, mode=0o700, exist_ok=True)
    os.chmod(copy, 0o700)

    locale = sql(secrets, "select datcollate from pg_database where datname = current_database()").strip()
    with open(os.path.join(copy, "locale.txt"), "w") as f:
        f.write(locale + "\n")
    print("locale:", locale)

    dumps(secrets, copy)
    print("dumps: ok")

    rows = objects(secrets)
    fd = os.open(os.path.join(copy, "objects.tsv"), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.writelines(f"{b}\t{n}\t{s}\n" for b, n, s in rows)

    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        errors = [e for e in pool.map(lambda o: download(secrets, copy, o), rows) if e]
    if errors:
        with open(os.path.join(copy, "storage_download.log"), "w") as f:
            f.writelines(e + "\n" for e in errors)
    print(f"storage: {len(rows) - len(errors)}/{len(rows)} objects, {sum(s for _, _, s in rows) / 1e6:.1f} MB")
    if errors:
        raise SystemExit(f"{len(errors)} downloads failed, see storage_download.log")


def main():
    args = sys.argv[1:]
    if len(args) < 3 or args[0] not in ("check", "take") or args[1] != "--env-file":
        raise SystemExit(__doc__)
    secrets = read_secrets(args[2])
    if args[0] == "check" and len(args) == 3:
        return check(secrets)
    if args[0] == "take" and len(args) == 4:
        return take(secrets, os.path.abspath(args[3]))
    raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
