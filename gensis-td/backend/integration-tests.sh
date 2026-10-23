#!/usr/bin/env bash
# Endpoint-level access tests (GensisTd.Api.IntegrationTests) against a throwaway PostgreSQL 17 and MinIO.
# Everything runs in containers on a private network with tmpfs storage and is removed afterwards; no host
# ports are opened and no real data is used. Extra arguments go to `dotnet test` (e.g. --filter RoleTests).
set -euo pipefail

cd "$(dirname "$0")"
run="gtd-it-$$"
net="$run-net"
pg_pass="$(openssl rand -hex 16)"
minio_pass="$(openssl rand -hex 16)"
minio_image="cgr.dev/chainguard/minio@sha256:32c504bea4574d8f29d719b37bc0dad920ecf3e22b81dc5cea0bb105af2ce10f"

cleanup() {
  docker rm -f "$run-db" "$run-storage" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create --internal "$net" >/dev/null
docker run -d --name "$run-db" --network "$net" --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD="$pg_pass" postgres:17-alpine >/dev/null
docker run -d --name "$run-storage" --network "$net" --tmpfs /data \
  -e MINIO_ROOT_USER=gtd-it -e MINIO_ROOT_PASSWORD="$minio_pass" "$minio_image" server /data >/dev/null

for i in $(seq 1 30); do
  docker exec "$run-db" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1 && break
  [ "$i" = 30 ] && { echo "database did not start" >&2; exit 1; }
  sleep 1
done

# The test container needs the internet for NuGet restore, so it joins the default bridge as well.
docker create --name "$run-test" -w /src/GensisTd.Api.IntegrationTests \
  -v "$PWD":/src -v gtd-nuget:/root/.nuget/packages \
  -e GTD_IT_DB="Host=$run-db;Database=postgres;Username=postgres;Password=$pg_pass" \
  -e GTD_IT_STORAGE_URL="http://$run-storage:9000" -e GTD_IT_STORAGE_KEY=gtd-it -e GTD_IT_STORAGE_SECRET="$minio_pass" \
  mcr.microsoft.com/dotnet/sdk:10.0 dotnet test "$@" >/dev/null
docker network connect "$net" "$run-test"
trap 'docker rm -f "$run-test" >/dev/null 2>&1 || true; cleanup' EXIT
docker start -a "$run-test"
