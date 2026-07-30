#!/usr/bin/env bash
# release-electron.sh — shared pipeline for the Electron apps in the fleet.
#
# electron-builder is the one toolchain here that genuinely cross-builds: from
# this Mac it produces macOS .dmg/.pkg/.zip, Windows NSIS/portable/zip and Linux
# deb/AppImage without Wine, a VM or a container. Targets and artefact names
# live in each repo's electron-builder.yml; this script only handles version
# bumping, invoking the build, and publishing.
#
# A repo's scripts/release-local.sh sets RE_NAME/RE_SLUG and sources this.
#
#   --version X.Y.Z   explicit version instead of a patch bump
#   --upload          tag and publish the GitHub release
#   --mac/--win/--linux   restrict platforms (default: all three)
set -euo pipefail

: "${RE_NAME:?set RE_NAME}"; : "${RE_SLUG:?set RE_SLUG}"

repo="$(cd "$(dirname "${BASH_SOURCE[1]}")/.." && pwd)"
cd "$repo"
source "$repo/scripts/release-lib.sh"

out="$repo/dist-release"
upload=0; version=""; platforms=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload)  upload=1 ;;
    --version) version="$2"; shift ;;
    --mac)     platforms+=" --mac" ;;
    --win)     platforms+=" --win" ;;
    --linux)   platforms+=" --linux" ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ -z "$platforms" ]] && platforms="--mac --win --linux"

current="$(node -p "require('./package.json').version")"
if [[ -z "$version" ]]; then
  version="$(awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}' <<<"$current")"
fi
tag="v${version}"
echo "==> ${RE_NAME} ${current} -> ${version}"

node -e "
const fs=require('fs'), p='package.json';
const d=JSON.parse(fs.readFileSync(p));
d.version='${version}';
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
"
# package-lock carries the version too; keep them in step without a full install.
npm version "${version}" --no-git-tag-version --allow-same-version >/dev/null 2>&1 || true

rl_init "$RE_NAME" "$RE_SLUG" "$version" "com.stoatworks.${RE_SLUG}" "$out"
rm -rf "$out"; mkdir -p "$out"

echo "==> npm install"
npm install --silent --no-audit --no-fund

echo "==> electron-vite build"
npm run build

# --publish never: this script owns publishing, and any configured provider in
# electron-builder.yml would otherwise try to upload on its own.
eb() {
  echo "==> electron-builder $*"
  npx --no-install electron-builder "$@" --publish never -c.directories.output="$out" \
    || { echo "electron-builder failed for: $*" >&2; return 1; }
}

[[ "$platforms" == *--mac* ]] && eb --mac
[[ "$platforms" == *--win*   ]] && eb --win
[[ "$platforms" == *--linux* ]] && eb --linux
true

# macOS .pkg is built here rather than by electron-builder.
#
# electron-builder's pkg target is not concurrency-safe: for every architecture
# it writes the same two scratch files into the output directory —
# distribution.xml and <appId>.pkg — feeds them to productbuild, then unlinks
# them. With both arches in flight one run deletes what the other is reading,
# failing as "Specified distribution ... not found" or "ENOENT: unlink". The
# CLI --x64/--arm64 flags do not help (an explicit `arch:` list in the config
# outranks them) and -c.mac.target merges with the existing array rather than
# replacing it, so neither can serialise the two.
#
# Using rl_pkg instead sidesteps it entirely and has the side benefit that the
# .pkg matches the ones the Rust and JUCE projects ship.
if [[ "$platforms" == *--mac* ]]; then
  for d in "$out"/mac "$out"/mac-arm64 "$out"/mac-universal; do
    [[ -d "$d" ]] || continue
    appname="$(cd "$d" && ls -d *.app 2>/dev/null | head -1)"
    [[ -n "$appname" ]] || continue
    case "$(basename "$d")" in
      mac)           arch=x64 ;;
      mac-arm64)     arch=arm64 ;;
      mac-universal) arch=universal ;;
    esac
    rl_pkg "macos-${arch}" "$d" --app "$appname"
  done
fi

# electron-builder leaves update manifests, blockmaps and unpacked trees behind.
# Keep only what a user would actually download.
#
# -mindepth 1 is load-bearing: without it the directory test matches "$out"
# itself and deletes the entire release along with the scaffolding.
find "$out" -mindepth 1 -maxdepth 1 -type f \( -name '*.blockmap' \
     -o -name 'latest*.yml' -o -name 'builder-*.yml' -o -name 'builder-*.yaml' \
     -o -name '*.plist' -o -name '.icon-*' \) -delete 2>/dev/null || true
find "$out" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} + 2>/dev/null || true

rl_summary

cat <<NOTE

    Unsigned. macOS users must run
      xattr -dr com.apple.quarantine "/Applications/${RE_NAME}.app"
    after installing.
NOTE

if (( upload )); then
  echo "==> tagging ${tag}"
  git add -A
  git commit -m "release: ${tag}" || true
  git tag -a "$tag" -m "${RE_NAME} ${version}" || true
  git push origin HEAD --tags
  gh release create "$tag" --title "${RE_NAME} ${version}" \
     --notes "Local build — GitHub Actions minutes are exhausted, so these artefacts were cut on a Mac. Unsigned: see the README for the macOS quarantine step." \
     "$out"/* \
    || gh release upload "$tag" "$out"/* --clobber
fi
