#!/bin/sh
# Import the built image into the node's containerd and helm-upgrade the release.
set -e

: "${DEPLOY_HOST:?DEPLOY_HOST is required (user@host)}"
: "${RELEASE:?RELEASE is required}"
: "${NAMESPACE:?NAMESPACE is required}"

mkdir -p /tmp
wget --no-check-certificate -qO /tmp/olve-lib.sh \
  https://raw.githubusercontent.com/OliverVea/Olve.Pipelines/main/.pipelines/scripts/olve-lib.sh
. /tmp/olve-lib.sh

HOST_ONLY="${DEPLOY_HOST#*@}"
olve_ssh_host "$HOST_ONLY"

INPUT_DIR=$(olve_bundle_input)
VERSION=$(cat "$INPUT_DIR/version.txt")
echo "Deploying $RELEASE:$VERSION"

# The image is pushed nowhere: it is imported straight into the k3s containerd, which
# is why the chart's pullPolicy is Never.
olve_image_import "$INPUT_DIR/image.tar" "$DEPLOY_HOST"

# olve_helm_deploy bakes the image.repository / image.tag / pullPolicy=Never overrides
# that this import-then-deploy flow always needs.
olve_helm_deploy "$DEPLOY_HOST" "$RELEASE" "$NAMESPACE" "$INPUT_DIR/helm" "$VERSION"

echo "Deployed $RELEASE:$VERSION"
