#!/bin/bash
# One-shot MinIO setup (KRR-016): buckets plus a restricted access key for the backend.
# Runs with the root credentials; the backend only ever gets MINIO_APP_USER / MINIO_APP_PASSWORD.
# Buckets must match StorageOptions.Buckets and app-policy.json.
set -euo pipefail
export MC_CONFIG_DIR=/tmp/mc

for i in $(seq 1 30); do
  mc alias set gtd http://storage:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1 && break
  [ "$i" = 30 ] && { echo "storage not reachable" >&2; exit 1; }
  sleep 2
done

for bucket in documents certificates; do
  mc mb --ignore-existing "gtd/$bucket"
done

mc admin policy create gtd gensis-td-app /init/app-policy.json
# Adding an existing user updates its secret.
mc admin user add gtd "$MINIO_APP_USER" "$MINIO_APP_PASSWORD"
# Attach only if not attached yet (attaching twice is an error). Look at the PolicyName line only:
# the AccessKey line can contain the same name. The image has no grep; match in bash.
attached=no
while IFS= read -r line; do
  [[ $line == PolicyName:*gensis-td-app* ]] && attached=yes
done <<< "$(mc admin user info gtd "$MINIO_APP_USER")"
if [[ $attached == no ]]; then
  mc admin policy attach gtd gensis-td-app --user "$MINIO_APP_USER"
fi
echo "storage init done"
