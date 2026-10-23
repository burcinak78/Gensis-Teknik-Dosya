"""Data migration into an existing deployment (prod on server01): the rehearsal's load, against a running compose stack.

Run on the server by STATON, from a read-only copy of live made with snapshot.py (folder 700, personal data).
Needs only docker and python3. The copy's dumps are opened in a throwaway source container (`gtd-migrate-source`:
Postgres 17, no network, tmpfs; built like prova.py's old side), removed at the end.

  load    target must be migrated (backend deployed once) and empty: every public table except the migration history
          without rows, both buckets without objects. Then: auth.users → users (bcrypt hashes as they are), public
          data-only, storage files → MinIO, then `verify`.
  verify  source vs target: every table's row count and content hash, users (id, e-mail, password hash, dates),
          storage objects with their sizes; accounts without a password. Exit code 1 on any difference.
  wipe    rollback: empties every public table except the migration history and both buckets, so `load` can run
          again. Asks for the project name to be typed; `--yes <project>` for non-interactive use.

Secrets (DB and MinIO root) are read from the deployment's .env and passed to containers through the environment;
they are never printed. Output holds table names and counts only.

Usage (python3 -I migrate.py ...):
  load   <copy> --dir /opt/apps/gensis-td-prod [--project gensis-td-prod] [--compose-file docker-compose.server.yml]
  verify <copy> --dir ... [same options]
  wipe          --dir ... [same options] [--yes <project>]
The project defaults to COMPOSE_PROJECT_NAME from <dir>/.env.
"""
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ next to the copy tools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prova  # noqa: E402

KEEP = "__EFMigrationsHistory"
# Own source container, so a rehearsal's old side on the same machine is never touched.
prova.OLD = "gtd-migrate-source"


def parse(argv):
    if not argv or argv[0] not in ("load", "verify", "wipe"):
        raise SystemExit(__doc__)
    cmd, rest = argv[0], argv[1:]
    copy = None
    if cmd != "wipe":
        if not rest or rest[0].startswith("--"):
            raise SystemExit(__doc__)
        copy, rest = os.path.abspath(rest[0]), rest[1:]
    opts = {"--dir": None, "--project": None, "--compose-file": "docker-compose.server.yml", "--yes": None}
    while rest:
        if rest[0] not in opts or len(rest) < 2:
            raise SystemExit(__doc__)
        opts[rest[0]], rest = rest[1], rest[2:]
    if not opts["--dir"]:
        raise SystemExit(__doc__)
    return cmd, copy, opts


def target_from(opts):
    d = os.path.abspath(opts["--dir"])
    env_file = os.path.join(d, ".env")
    project = opts["--project"] or prova.read_env_file(env_file).get("COMPOSE_PROJECT_NAME")
    if not project:
        raise SystemExit("no --project and no COMPOSE_PROJECT_NAME in .env")
    t = prova.Target(project, os.path.join(d, opts["--compose-file"]), env_file, project_dir=d)
    missing = [k for k in ("DB_USER", "DB_NAME", "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD") if not t.env.get(k)]
    if missing:
        raise SystemExit(f"missing in {env_file}: {', '.join(missing)}")
    return t


def check_copy(copy):
    for name in ("public.dump", "auth_storage_data.dump", "objects.tsv", "storage"):
        if not os.path.exists(os.path.join(copy, name)):
            raise SystemExit(f"not a snapshot copy (no {name}): {copy}")


def table_counts(target):
    """{table: rows} for every public table but the migration history (one query)."""
    tables = [t for t in target.psql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' "
                                     "AND table_type = 'BASE TABLE' ORDER BY 1").split("\n") if t and t != KEEP]
    if not tables:
        raise SystemExit("target has no tables: deploy the backend first (migrate service)")
    sql = " UNION ALL ".join(f"SELECT '{t}', count(*) FROM public.\"{t}\"" for t in tables)
    return {name: int(n) for name, n in (line.split("|") for line in target.psql(sql).split("\n") if line)}


def object_count(target):
    return len(prova.minio_objects(target))


def source_up(copy):
    if prova.run(["docker", "inspect", prova.OLD], capture=True, check=False).returncode == 0:
        raise SystemExit(f"container {prova.OLD} exists (a rehearsal or an earlier run): remove it first")
    prova.old_up(copy)


def source_down():
    prova.run(["docker", "rm", "-fv", prova.OLD], capture=True, check=False)


def verify(copy, target):
    rows = prova.compare(copy, target)
    diffs = [r for r in rows if r[1] is not None]
    print("\n## tablolar (kaynak = hedef)")
    for check, kind, d in rows:
        if check == "tablolar" and kind is None:
            print(f"  {d['table']:<28} {d['rows']:>8}")
    print("\n## kullanıcılar ve storage")
    for check, kind, d in rows:
        if check != "tablolar" and kind is None:
            print(f"  {check}: {d}")
    print(f"\n## farklar: {len(diffs)}")
    for check, kind, d in diffs:
        print(f"  {check}: {kind} {d}")
    return not diffs


def load(copy, target):
    counts = table_counts(target)
    busy = {t: n for t, n in counts.items() if n}
    objects = object_count(target)
    if busy or objects:
        raise SystemExit(f"target is not empty ({len(busy)} tables with rows, users {counts.get('users', 0)}, "
                         f"projects {counts.get('projects', 0)}, {objects} storage objects): nothing loaded. "
                         "To load again: wipe")
    source_up(copy)
    try:
        print("loading users, public data, storage ...")
        prova.load(copy, target)
        return verify(copy, target)
    finally:
        source_down()


def wipe(target, confirm):
    counts = table_counts(target)
    print(f"{target.project}: {sum(counts.values())} rows in {sum(1 for n in counts.values() if n)} tables, "
          f"{object_count(target)} storage objects will be deleted (schema and migration history stay).")
    if confirm is None:
        try:
            confirm = input(f"type the project name ({target.project}) to delete: ").strip()
        except EOFError:
            confirm = ""
    if confirm != target.project:
        raise SystemExit("not confirmed: nothing deleted")
    tables = ", ".join(f'public."{t}"' for t in counts)
    target.psql(f"TRUNCATE {tables} CASCADE")
    target.mc("; ".join(f"mc rm --recursive --force p/{b} >/dev/null || true" for b in prova.BUCKETS))
    left = sum(table_counts(target).values()), object_count(target)
    print(f"emptied: {left[0]} rows, {left[1]} objects left")
    return left == (0, 0)


def main():
    cmd, copy, opts = parse(sys.argv[1:])
    target = target_from(opts)
    if cmd == "wipe":
        ok = wipe(target, opts["--yes"])
    else:
        check_copy(copy)
        if cmd == "load":
            ok = load(copy, target)
        else:
            source_up(copy)
            try:
                ok = verify(copy, target)
            finally:
                source_down()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
