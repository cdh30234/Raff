#!/bin/sh
# Build Raff for macOS and publish it as a GitHub release.
#
# Installed copies of Raff read the latest release of the repo below: once this
# finishes, they offer the update within a few hours (or at their next launch).
#
# Needs: the GitHub CLI, signed in once:  brew install gh && gh auth login
# Usage: raise "version" in package.json, then:  npm run release:mac
set -e
cd "$(dirname "$0")/.."

REPO="cdh30234/Raff"
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

command -v gh >/dev/null || { echo "GitHub CLI missing: brew install gh && gh auth login"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not signed in to GitHub: gh auth login"; exit 1; }
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release $TAG already exists (maybe a draft from a failed upload). Raise \"version\" in package.json, or delete the draft on GitHub."
  exit 1
fi

# A local Electron (node_modules/electron/dist) saves a 120 MB download per build.
rm -rf dist
npm run build
npx electron-builder --mac dmg zip --arm64 --publish never -c.electronDist=node_modules/electron/dist

# The zip is what the in-app updater downloads; latest-mac.yml holds its SHA-512.
# Over a slow link GitHub can drop a long upload (HTTP 408), so: a draft first
# (installed apps never see drafts), each big file with retries, publish last.
gh release create "$TAG" dist/latest-mac.yml --repo "$REPO" --draft --title "Raff $VERSION" --generate-notes

for f in "dist/Raff-$VERSION-mac-arm64.zip" "dist/Raff-$VERSION-mac-arm64.dmg"; do
  name=$(basename "$f")
  size=$(stat -f %z "$f")
  done_upload=0
  for attempt in 1 2 3 4 5 6; do
    have=$(gh release view "$TAG" --repo "$REPO" --json assets --jq ".assets[] | select(.name==\"$name\" and .state==\"uploaded\") | .size")
    if [ "$have" = "$size" ]; then done_upload=1; break; fi
    echo "Uploading $name (attempt $attempt)..."
    if gh release upload "$TAG" "$f" --repo "$REPO" --clobber; then done_upload=1; break; fi
    sleep 10
  done
  [ "$done_upload" = 1 ] || { echo "Upload of $name failed. The draft $TAG is kept: run this script's upload part again."; exit 1; }
done

gh release edit "$TAG" --repo "$REPO" --draft=false --latest
echo "Published $TAG: https://github.com/$REPO/releases/tag/$TAG"
