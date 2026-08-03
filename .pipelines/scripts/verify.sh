#!/bin/sh
# Post-deploy verification: the rollout completed AND the page is actually served
# through the ingress at its real hostname.
set -e

: "${DEPLOY_HOST:?DEPLOY_HOST is required (user@host)}"
: "${RELEASE:?RELEASE is required}"
: "${NAMESPACE:?NAMESPACE is required}"

apk add --no-cache openssh-client curl

mkdir -p ~/.ssh
echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H "${DEPLOY_HOST#*@}" >> ~/.ssh/known_hosts 2>/dev/null || true

echo "--- rollout ---"
ssh -o StrictHostKeyChecking=no "$DEPLOY_HOST" \
  "kubectl -n $NAMESPACE rollout status deploy/$RELEASE --timeout=5m"

if [ -n "$SITE_URL" ]; then
  echo "--- site responds ---"
  # --resolve pins the request to the cluster's own ingress IP. Without it the job
  # follows whatever public DNS says, which from inside the cluster can land on a
  # different entrypoint and 404 — a false failure that says nothing about this deploy.
  RESOLVE=""
  if [ -n "$INGRESS_IP" ]; then
    HOSTNAME_ONLY=$(echo "$SITE_URL" | sed -e 's|^https\{0,1\}://||' -e 's|/.*$||')
    RESOLVE="--resolve $HOSTNAME_ONLY:443:$INGRESS_IP"
  fi
  # shellcheck disable=SC2086
  CODE=$(curl -sk $RESOLVE -o /tmp/page.html -w "%{http_code}" --max-time 30 "$SITE_URL/" || echo 000)
  echo "GET $SITE_URL/ -> $CODE"
  [ "$CODE" = "200" ] || { echo "site did not return 200"; exit 1; }

  # A 200 from the wrong nginx default page would still be a 200. Assert the page is
  # actually ours.
  grep -q "homelab" /tmp/page.html || { echo "served page is not the dashboard"; exit 1; }
  echo "page content looks right"
else
  echo "SITE_URL unset — skipping HTTP check"
fi

echo "Verified $RELEASE in $NAMESPACE"
