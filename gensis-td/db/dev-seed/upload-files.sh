#!/bin/bash
# Puts files/test-belge.pdf at every key in files.txt (bucket "documents"), or removes them.
# Runs inside the storage-init image (it has mc and the root credentials), from the compose directory:
#   docker compose -f docker-compose.server.yml run --rm --no-deps -v "$PWD/dev-seed:/seed:ro" \
#     --entrypoint /bin/bash storage-init /seed/upload-files.sh [upload|remove]
set -euo pipefail
export MC_CONFIG_DIR=/tmp/mc
action="${1:-upload}"
mc alias set gtd http://storage:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
n=0
while IFS= read -r key; do
  [[ -z $key ]] && continue
  case $action in
    upload) mc cp --quiet /seed/files/test-belge.pdf "gtd/documents/$key" >/dev/null ;;
    remove) mc rm --quiet "gtd/documents/$key" >/dev/null || true ;;
    *) echo "usage: upload-files.sh [upload|remove]" >&2; exit 2 ;;
  esac
  n=$((n + 1))
done < /seed/files.txt
echo "$action: $n files"
