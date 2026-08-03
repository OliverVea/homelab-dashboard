#!/bin/sh
# Build the dashboard image with Kaniko and stage the chart into the bundle.
set -e

: "${REPO:?REPO is required (owner/name on GitHub)}"
BRANCH="${BRANCH:-main}"

# Shared helper library — the Kaniko and repo-fetch footguns live there, not here.
mkdir -p /tmp
wget --no-check-certificate -qO /tmp/olve-lib.sh \
  https://raw.githubusercontent.com/OliverVea/Olve.Pipelines/main/.pipelines/scripts/olve-lib.sh
. /tmp/olve-lib.sh

VERSION=$(olve_version)
CTX=/kaniko/build-context

# NOT olve_fetch_repo: it always sends `Authorization: token $GITHUB_TOKEN`, and with
# no token set (this repo is public, so the pipeline has no credentials secret) GitHub
# rejects the empty credential with a 401. Authenticate only when there is something to
# authenticate with.
mkdir -p "$CTX"
cd "$CTX"
if [ -n "$GITHUB_TOKEN" ]; then
  wget --no-check-certificate -q --header="Authorization: token $GITHUB_TOKEN"     -O repo.tar.gz "https://api.github.com/repos/$REPO/tarball/$BRANCH"
else
  wget --no-check-certificate -q -O repo.tar.gz     "https://api.github.com/repos/$REPO/tarball/$BRANCH"
fi
tar xzf repo.tar.gz --strip-components=1
rm repo.tar.gz

[ -f "$CTX/site/index.html" ] || { echo "site/index.html missing"; exit 1; }
[ -f "$CTX/Dockerfile" ] || { echo "Dockerfile missing"; exit 1; }

# Stage deploy artifacts into the bundle BEFORE Kaniko runs: it wipes the context
# root between stages, so anything the deploy steps need must be carried forward first.
mkdir -p /output
olve_stage_artifact "$CTX/helm" /output/helm
echo "$VERSION" > /output/version.txt

olve_kaniko_build "$CTX" "homelab-dashboard:$VERSION"

echo "Built homelab-dashboard:$VERSION"
ls -l /output
