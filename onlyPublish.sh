#!/bin/bash


auth_output=$(gh auth status 2>&1)
if echo "$auth_output" | grep -q 'github\.com as nodalityjs'; then
  echo "🚀 Logged in as nodalityjs — continuing."
else
  echo "🚫 Not logged in as nodalityjs. Aborting."
  exit 1
fi

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
VERSION="1.0.86"

git add .
git commit -m "release: v$VERSION"
git tag "v$VERSION"

#if ! git push --set-upstream origin main; then
#  echo "Push failed, pulling with rebase..."
#  git pull --rebase origin main && git push origin main
# fi

if git push --set-upstream origin main; then
  echo "🚀 Commits pushed to GitHub successfully."
else
  echo "⚠️ Push failed, attempting pull with rebase..."
fi
