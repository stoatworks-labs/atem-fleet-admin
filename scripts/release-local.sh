#!/usr/bin/env bash
# release-local.sh — cut a full ATEM Fleet Admin release from this Mac.
#
# GitHub Actions minutes are exhausted, so releases are built here.
# electron-builder cross-builds all three platforms from macOS; the target list
# lives in electron-builder.yml. Shared logic is in scripts/release-electron.sh.
#
#   scripts/release-local.sh                  build into dist-release/
#   scripts/release-local.sh --version 1.2.0  set an explicit version
#   scripts/release-local.sh --mac            restrict to one platform
#   scripts/release-local.sh --upload         tag and publish the GitHub release
set -euo pipefail

RE_NAME="ATEM Fleet Admin"
RE_SLUG="atem-fleet-admin"

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-electron.sh"
