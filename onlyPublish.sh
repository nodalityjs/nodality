#!/bin/bash
#
# Strict mode. Without it a failure in the middle of this script is
# invisible: the `cp -R` steps below are what make a release contain the
# new code, and if one of them failed the script used to carry on and
# test, tag, push and publish the PREVIOUS copy — green suite, successful
# release, stale artefact. The two commands that legitimately exit
# non-zero (gh auth status when logged out, lsof when nothing is
# listening) are guarded individually below.
set -euo pipefail


auth_output=$(gh auth status 2>&1 || true)
if echo "$auth_output" | grep -q 'github\.com as nodalityjs'; then
  echo "🚀 Logged in as nodalityjs — continuing."
else
  echo "🚫 Not logged in as nodalityjs. Aborting."
  exit 1
fi


# Copy layout folders (root for publish)
cp -R /Users/filipvabrousek/Desktop/layout/layout /Users/filipvabrousek/launch/
cp -R /Users/filipvabrousek/Desktop/layout/lib /Users/filipvabrousek/launch/
cp -R /Users/filipvabrousek/Desktop/layout/assets /Users/filipvabrousek/launch/
# bin/ holds the `nodality` CLI binary (e.g. `npx nodality prerender`).
# Mirror behaviour of the other copies above so it's available to
# both the published tarball and to the e2e test pages.
cp -R /Users/filipvabrousek/Desktop/layout/bin /Users/filipvabrousek/launch/

# Mirror into public/ so e2e test pages can resolve ../layout/* and ../lib/* and ../assets/*
rm -rf /Users/filipvabrousek/launch/public/layout
rm -rf /Users/filipvabrousek/launch/public/lib
rm -rf /Users/filipvabrousek/launch/public/assets
cp -R /Users/filipvabrousek/Desktop/layout/layout /Users/filipvabrousek/launch/public/
cp -R /Users/filipvabrousek/Desktop/layout/lib /Users/filipvabrousek/launch/public/
cp -R /Users/filipvabrousek/Desktop/layout/assets /Users/filipvabrousek/launch/public/

# ----------------------------
# Kill any stale dev/test servers on 3000-3010 so playwright starts fresh
# (reuseExistingServer would otherwise latch onto the wrong-rooted server)
# ----------------------------
for port in 3000 3001 3002 3003 3004 3005; do
  pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "🧹 Killing stale process $pid on port $port"
    kill -9 $pid 2>/dev/null || true
  fi
done

# ----------------------------
# Run tests locally first
# ----------------------------
echo "🧪 Running local tests..."
if ! npm run test; then
  echo "❌ Tests failed. Aborting release."
  exit 1
fi
echo "✅ All tests passed."

# ----------------------------
# Packaged tarball smoke test
# ----------------------------
# Mirrors the `pack` job in .github/workflows/npm-publish.yml so a broken
# package surface is caught here rather than after the tag is already
# pushed. The suite above resolves ../layout/* and ../lib/* inside this
# repo, so it never exercises package.json's main, exports, bin or files —
# all of which can be wrong with every test green. One was: `main` and
# `exports["."].require` pointed at ./dist/index.js while the build emits
# dist/index.cjs.js, so require("nodality") failed with MODULE_NOT_FOUND
# for every CommonJS consumer, across releases, invisibly.
#
# Runs BEFORE the version bump on purpose: if it fails, package.json has
# not been touched and the working tree is still clean, so the abort
# leaves nothing half-done. The tarball therefore carries the PREVIOUS
# version number, which none of the checks depend on — they assert paths,
# imports and the bin, not the version string.
#
# The .tgz is a local scratch artefact (already covered by *.tgz in
# .gitignore, and removed below). GitHub rebuilds and repacks its own.
echo "📦 Packing and smoke-testing the tarball..."
PACK_FIXTURE="$(mktemp -d)"
PACK_TARBALL=""

pack_cleanup() {
  [ -n "$PACK_TARBALL" ] && rm -f "$PACK_TARBALL"
  [ -n "$PACK_FIXTURE" ] && rm -rf "$PACK_FIXTURE"
  return 0
}

if ! npm run build; then
  echo "❌ Build failed. Aborting release."
  pack_cleanup; exit 1
fi
npm run inject-license || true

# Absolute, because the install runs from inside the fixture directory.
# $PWD rather than $0's directory: npm pack writes to the current working
# directory, so that is the only place the tarball is guaranteed to be.
PACK_TARBALL="$PWD/$(npm pack --silent | tail -1)"
if [ ! -f "$PACK_TARBALL" ]; then
  echo "❌ npm pack produced no tarball. Aborting release."
  pack_cleanup; exit 1
fi

printf '{"name":"pack-smoke","version":"1.0.0","type":"module","private":true}\n' \
  > "$PACK_FIXTURE/package.json"
if ! (cd "$PACK_FIXTURE" && npm install "$PACK_TARBALL" >/dev/null 2>&1); then
  echo "❌ The packed tarball would not install. Aborting release."
  pack_cleanup; exit 1
fi

if ! node packaging/smoke.mjs "$PACK_FIXTURE"; then
  echo "❌ Packaged smoke test failed. Aborting release."
  pack_cleanup; exit 1
fi

pack_cleanup
echo "✅ Packaged tarball is sound."

# ----------------------------
# Commit, tag, and push
# ----------------------------
# Bump patch version in package.json (e.g. 1.0.121 -> 1.0.122)
node -e "
const fs = require('fs');
const path = './package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
const parts = pkg.version.split('.').map(Number);
parts[2] += 1;
pkg.version = parts.join('.');
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
console.log('🔖 Version bumped to ' + pkg.version);
"

VERSION=$(node -p "require('./package.json').version")

git add .
git commit -m "release: v$VERSION"
git tag "v$VERSION"

# Push commits
#
# A failed branch push ABORTS, before the tag is pushed. It used to warn
# and fall through: the tag went out anyway, the workflow published from
# it, and main was left behind the registry — so the released commit
# existed only on the tag and the next release started from a divergence.
#
# The tag push is the point of no return (it is what triggers publishing),
# so everything that can still be recovered cheaply has to fail before it.
# Nothing has been published at this point; the local commit and tag are
# still discardable with:
#     git tag -d "v$VERSION" && git reset --hard HEAD~1
if git push --set-upstream origin main; then
  echo "🚀 Commits pushed to GitHub successfully."
else
  echo "❌ Failed to push main. Aborting BEFORE the tag goes out, so"
  echo "   nothing is published and main cannot fall behind npm."
  echo "   Likely a diverged remote — reconcile, then re-run:"
  echo "     git pull --rebase origin main"
  echo "   To discard this release attempt entirely:"
  echo "     git tag -d \"v$VERSION\" && git reset --hard HEAD~1"
  exit 1
fi

# Push tag
if git push origin "v$VERSION"; then
  echo "🚀 Tag v$VERSION pushed to GitHub successfully."
else
  echo "❌ Failed to push tag v$VERSION. Aborting."
  exit 1
fi


# ----------------------------
# Wait for npm to actually serve the version
# ----------------------------
# The tag push above is the TRIGGER, not the publish. GitHub's workflow
# re-runs the suite and the packaged smoke test and only then calls
# `npm publish` — typically 3-5 minutes later. Until that lands the
# registry still serves the PREVIOUS version, and a consumer running
# `npm i nodality@latest` installs it silently: no error, no warning, and
# a build that looks entirely successful.
#
# That is not hypothetical. It happened on both 1.0.199 and 1.0.201: a
# consumer project installed the previous release, prerendered against it
# and was moments from deploying before the version was checked by hand.
#
# Blocking here makes this script's exit mean what everyone assumes it
# already means — the version is installable.
echo "⏳ Waiting for npm to serve $VERSION (GitHub publishes it; usually 3-5 min)…"
WAIT_DEADLINE=$(( SECONDS + 900 ))
until [ "$(npm view nodality version 2>/dev/null || true)" = "$VERSION" ]; do
  if [ "$SECONDS" -ge "$WAIT_DEADLINE" ]; then
    echo "⚠️  npm still does not serve $VERSION after 15 minutes."
    echo "    The tag is pushed, so the release may still be in flight."
    echo "    Check the workflow:  gh run list --limit 3"
    exit 1
  fi
  sleep 15
done
echo "✅ nodality $VERSION is live on npm — consumers can upgrade."
