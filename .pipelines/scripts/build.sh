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

olve_fetch_repo "$REPO" "$BRANCH" "$CTX"

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
