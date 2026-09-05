#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('${REPO_DIR}/manifest.json', 'utf8')).version")"
RELEASE_DIR="${REPO_DIR}/releases"
ARCHIVE_PATH="${RELEASE_DIR}/grayscale-filter-v${VERSION}.zip"

mkdir -p "${RELEASE_DIR}"
rm -f "${ARCHIVE_PATH}"

cd "${REPO_DIR}"
zip -q -r "${ARCHIVE_PATH}" \
  manifest.json \
  background.js \
  content.js \
  icons \
  popup \
  utils

echo "Created ${ARCHIVE_PATH}"
