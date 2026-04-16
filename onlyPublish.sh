#!/bin/bash


auth_output=$(gh auth status 2>&1)
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
  pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null)
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
if git push --set-upstream origin main; then
  echo "🚀 Commits pushed to GitHub successfully."
else
  echo "⚠️ Push failed, attempting pull with rebase..."
  #if git pull --rebase origin main && git push origin main; then
    #echo "🚀 Commits pushed after rebase."
  #else
    #echo "❌ Push failed after rebase. Aborting."
    #exit 1
  #fi
fi

# Push tag
if git push origin "v$VERSION"; then
  echo "🚀 Tag v$VERSION pushed to GitHub successfully."
else
  echo "❌ Failed to push tag v$VERSION. Aborting."
  exit 1
fi