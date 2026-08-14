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


# ----------------------------
# Sync with origin/main first
# ----------------------------
# Every release now opens a changelog PR, and merging it puts main ahead
# of this clone. Being behind is therefore the NORMAL state between
# releases, not bad luck. Building on a stale main gets the push rejected
# and the guard aborts — after a full local test + pack run has already
# been paid for.
#
# --autostash, NOT a clean-tree requirement: uncommitted work in this repo
# is expected at release time. The workflow, specs and packaging scripts
# that shipped in 1.0.207 were uncommitted right up until `git add .`
# swept them in, so refusing to release with a dirty tree would block the
# normal case.
#
# On conflict the rebase is aborted rather than left half-applied, so a
# failed release never leaves the repo mid-rebase to be discovered later.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "🚫 On branch '$BRANCH', not main. Aborting so the release is not built here."
  exit 1
fi

echo "🔄 Syncing with origin/main…"
if ! git pull --rebase --autostash origin main; then
  git rebase --abort 2>/dev/null || true
  echo "❌ Could not rebase onto origin/main. Nothing has been released."
  echo "   Resolve the conflict, then re-run. If work was autostashed it is"
  echo "   still recoverable:  git stash list"
  exit 1
fi

# Copy layout folders (root for publish)
#
# Cleared first, because `cp -R` copies over but never DELETES. A file
# removed from the sandbox survived here indefinitely and kept shipping in
# the tarball — the sandbox is the source of truth, so anything it no
# longer has must not be published. The public/ mirror below already did
# this; the publish copy did not, which is the half that reaches npm.
rm -rf /Users/filipvabrousek/launch/layout
rm -rf /Users/filipvabrousek/launch/lib
rm -rf /Users/filipvabrousek/launch/assets
rm -rf /Users/filipvabrousek/launch/bin
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

# ----------------------------
# Type definitions must be in the tarball
# ----------------------------
# `npm run build` now chains scripts/generate-types.mjs, which reads the freshly
# built bundle and emits dist/index.d.ts. That chaining is what makes types
# reach consumers: dist/ is gitignored, so the .d.ts is never committed, and the
# tarball that actually gets published is built by GitHub Actions from the tag —
# which runs `npm run build` and nothing else. Generating types HERE alone would
# give a locally correct package and a published one with no types at all, with
# every check green.
#
# This block is the guard for that arrangement. If the generator is removed from
# the build script, or throws, or the DOM stub stops satisfying the bundle, the
# release aborts here instead of publishing a package whose `types` field points
# at a file that does not exist — which is worse than having no types, because
# editors and tsc report the package as broken rather than untyped.
#
# Checked before `npm pack` on purpose, so the smoke test below exercises a
# tarball that genuinely contains the declarations.
echo "🔤 Checking type definitions…"
if [ ! -s dist/index.d.ts ]; then
  echo "❌ dist/index.d.ts is missing or empty after the build."
  echo "   package.json declares \"types\": \"dist/index.d.ts\", so publishing now"
  echo "   would ship a broken type entry point. Check that npm run build still"
  echo "   chains scripts/generate-types.mjs, then re-run."
  pack_cleanup; exit 1
fi
if ! grep -q "export class Des" dist/index.d.ts; then
  echo "❌ dist/index.d.ts exists but does not declare Des."
  echo "   The generator loads the bundle with a minimal DOM stub; if that stub"
  echo "   no longer satisfies it, the export list comes back empty and the"
  echo "   declarations are silently useless. Aborting."
  pack_cleanup; exit 1
fi
echo "✅ dist/index.d.ts present ($(grep -c "^export class" dist/index.d.ts) classes)."

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
#     git tag -d "v$VERSION" && git reset --soft HEAD~1
#
# --soft, NOT --hard. This commit sweeps in everything `git add .` found,
# including files that live ONLY in this repo (the workflow, packaging
# scripts, specs and fixtures). --hard would delete them outright, and
# unlike layout/ and lib/ they are not recoverable by re-copying from
# ~/Desktop/layout. --soft drops the commit and leaves the work staged.
if git push --set-upstream origin main; then
  echo "🚀 Commits pushed to GitHub successfully."
else
  echo "❌ Failed to push main. Aborting BEFORE the tag goes out, so"
  echo "   nothing is published and main cannot fall behind npm."
  echo "   Likely a diverged remote — reconcile, then re-run:"
  echo "     git pull --rebase origin main"
  echo "   To discard this release attempt entirely:"
  echo "     git tag -d \"v$VERSION\" && git reset --soft HEAD~1"
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

# ----------------------------
# Refresh the generated docs tables
# ----------------------------
# Only reached when the ENTIRE release succeeded: tests, packaged smoke
# test, scaffold build, both pushes, and npm actually serving the version.
# That ordering is the point — the reference must never describe code that
# failed verification or never shipped.
#
# The file is read out of the tag rather than the working tree, because
# the sandbox is copied into this repo BEFORE the tests run (see the cp -R
# lines above), so a failed attempt leaves unreleased code sitting here.
#
# This regenerates markdown in the docs repo and stops. It does NOT
# publish: deploying the site stays a deliberate act, run by hand from
# that repo when you have read the diff.
DOCS_DIR="${DOCS_DIR:-/Users/filipvabrousek/docosaurus-docs/nodality}"
GEN="$DOCS_DIR/scripts/generate-docs.mjs"

if [ -f "$GEN" ]; then
  echo "📖 Refreshing the generated docs from v$VERSION…"
  # Reads the tag this release just created — which holds exactly the
  # sandbox content, because the cp -R steps above put it there and it was
  # then committed and tagged. So this satisfies "same source as the other
  # files" while also being verifiable: deploy.sh checks the committed docs
  # against that same tag.
  #
  # Sourcing the sandbox directly worked, but left TWO sources in the
  # chain: this script generated from the sandbox while deploy.sh
  # regenerated from the tag, so publishing could revert the docs a release
  # had just written. One source removes the ambiguity entirely.
  if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    # Non-fatal on purpose. The release is already out; a docs hiccup must
    # not make a successful publish look like a failure.
    # Captured so the "did anything change" answer can drive whether the
    # docs are worth opening. A release that touched no raster op should
    # not spawn a dev server for a diff that does not exist.
    if GEN_OUT="$(LAUNCH_DIR="$PWD" node "$GEN" 2>&1)"; then
      echo "$GEN_OUT"
      if echo "$GEN_OUT" | grep -q "regenerated" && [ "${OPEN_DOCS:-1}" != "0" ]; then
        # Serve the docs so the regenerated tables can be read in place.
        # Backgrounded with nohup: this is the last step of a release and
        # the script must still exit. Set OPEN_DOCS=0 to skip.
        if lsof -ti tcp:3000 -sTCP:LISTEN >/dev/null 2>&1; then
          echo "   Docs server already running — http://localhost:3000/docs/raster/ops"
          open "http://localhost:3000/docs/raster/ops" 2>/dev/null || true
        else
          echo "   Starting the docs dev server…"
          ( cd "$DOCS_DIR" && nohup npm start >/tmp/nodality-docs-dev.log 2>&1 & ) || true
          # Docusaurus takes a few seconds to compile; poll rather than
          # guess, and give up quietly instead of hanging the release.
          for _ in $(seq 1 40); do
            curl -sf -o /dev/null http://localhost:3000/ && break
            sleep 1
          done
          if curl -sf -o /dev/null http://localhost:3000/; then
            open "http://localhost:3000/docs/raster/ops" 2>/dev/null || true
            echo "   Docs: http://localhost:3000/docs/raster/ops   (log: /tmp/nodality-docs-dev.log)"
          else
            echo "   ⚠️  Docs server did not come up — see /tmp/nodality-docs-dev.log" >&2
          fi
        fi
      fi
      echo "   Review and publish when ready:  cd $DOCS_DIR && ./deploy.sh"
    else
      echo "$GEN_OUT"
      echo "⚠️  Docs regeneration failed — the release itself is fine." >&2
    fi
  else
    echo "⚠️  Tag v$VERSION not found locally — docs not refreshed." >&2
  fi
fi
