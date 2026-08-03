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

# Some projects (the presentation-commander pair) create space-free
# vendor-sdk symlinks under native/ that point outside the project tree.
# electron-builder refuses to package those, so their own build:* scripts run
# clean:native-sdk-links first. Honour that here rather than reimplementing it,
# and skip silently for the projects that have no such script.
if node -e "process.exit(require('./package.json').scripts?.['clean:native-sdk-links'] ? 0 : 1)" 2>/dev/null; then
  echo "==> clean:native-sdk-links"
  npm run clean:native-sdk-links
fi

# --publish never: this script owns publishing, and any configured provider in
# electron-builder.yml would otherwise try to upload on its own.
eb() {
  echo "==> electron-builder $*"
  npx --no-install electron-builder "$@" --publish never -c.directories.output="$out" \
    || { echo "electron-builder failed for: $*" >&2; return 1; }
}

# Developer ID signing, when this machine is configured for it. The CLI -c
# overrides outrank the repos' `identity: '-'` ad-hoc setting, so the same
# config builds ad-hoc in CI and properly signed here. electron-builder's
# default entitlements already carry the JIT/unsigned-memory exceptions
# Electron needs; a repo that needs more ships scripts/mac-entitlements.plist,
# which rl_init picks up (helpers inherit it too — the renderers are the
# processes that actually JIT).
mac_sign_args=()
if rl_mac_sign_ready; then
  mac_sign_args+=(-c.mac.identity="$RL_MAC_SIGN_IDENTITY" -c.mac.hardenedRuntime=true)
  if [[ -n "${RL_MAC_ENTITLEMENTS:-}" && -f "${RL_MAC_ENTITLEMENTS:-}" ]]; then
    mac_sign_args+=(-c.mac.entitlements="$RL_MAC_ENTITLEMENTS"
                    -c.mac.entitlementsInherit="$RL_MAC_ENTITLEMENTS")
  fi
fi
[[ "$platforms" == *--mac* ]] && eb --mac "${mac_sign_args[@]}"
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

# Notarise the finished mac artefacts. electron-builder packs the dmg and zip
# itself, so — like Windows signing below — the only handle is the finished
# file. The dmg is submitted and stapled; a zip cannot be stapled but the
# submission registers the app's hashes, which is what Gatekeeper checks.
# Only zips that actually hold an .app are submitted: a Windows or Linux zip
# would be rejected at intake and abort the release.
if [[ "$platforms" == *--mac* ]] && rl_mac_sign_ready && rl_notary_ready; then
  while IFS= read -r a; do
    case "$a" in
      *.dmg) rl_mac_notarize "$a" || exit 1 ;;
      *.zip) unzip -l "$a" 2>/dev/null | grep -q '\.app/Contents/' \
               && { rl_mac_notarize "$a" || exit 1; } ;;
    esac
  done < <(find "$out" -mindepth 1 -maxdepth 1 -type f \
             \( -name '*.dmg' -o -name '*.zip' \) | sort)
fi

# Windows signing, post-hoc.
#
# Unlike the Rust and Python paths there is no staging directory to sign before
# packing: electron-builder builds its own NSIS installer internally, so the
# only handle we get is the finished artefact. Sign those here, BEFORE the
# cleanup below runs — blockmaps are checksums of the installer, so signing
# after they were written would invalidate them, and the tidy-up is what makes
# that harmless by deleting them.
#
# This covers the case that actually matters: the downloaded installer is the
# file carrying a Mark-of-the-Web, and MOTW is the only thing SmartScreen
# consults. The app .exe *inside* the installer stays unsigned — it is written
# to disk locally, so it is never MOTW-tagged and never reaches SmartScreen,
# but it does mean the binary itself carries no publisher identity. Closing
# that gap needs electron-builder's own `win.sign` hook pointed at jsign, which
# lives in each project's electron-builder config rather than here.
if [[ "$platforms" == *--win* ]]; then
  while IFS= read -r a; do
    rl_sign_windows "$a" || exit 1
  done < <(find "$out" -mindepth 1 -maxdepth 1 -type f -name '*.exe' | sort)
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

if (( RL_NOTARIZED_COUNT > 0 )); then
  echo
  echo "    macOS artefacts are Developer ID-signed and notarised — no quarantine step."
else
  cat <<NOTE

    macOS artefacts are not code-signed. Users must run
      xattr -dr com.apple.quarantine "/Applications/${RE_NAME}.app"
    after installing.
NOTE
fi

if (( upload )); then
  echo "==> tagging ${tag}"
  git add -A
  git commit -m "release: ${tag}" || true
  git tag -a "$tag" -m "${RE_NAME} ${version}" || true
  git push origin HEAD --tags
  gh release create "$tag" --title "${RE_NAME} ${version}" \
     --notes "Local build — GitHub Actions minutes are exhausted, so these artefacts were cut on a Mac. $(rl_notes_signing)" \
     "$out"/* \
    || gh release upload "$tag" "$out"/* --clobber
fi
