#!/bin/bash
echo "PUSHING"
git add .
git commit -m "release: v$npm_package_version"
git tag v$npm_package_version

if ! git push --set-upstream origin main; then
  echo "Push failed, pulling with rebase..."
  git pull --rebase origin main && git push origin main
fi

git push origin v$npm_package_version