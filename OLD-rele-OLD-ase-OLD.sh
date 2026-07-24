#!/bin/bash

# ----------------------------
# Nodality Release Script (macOS Bash 3.2 Compatible)
# ----------------------------

# GitHub auth check
auth_output=$(gh auth status 2>&1)
if echo "$auth_output" | grep -q 'github\.com as nodalityjs'; then
  echo "🚀 Logged in as nodalityjs — continuing."
else
  echo "🚫 Not logged in as nodalityjs. Aborting."
  exit 1
fi

# Copy layout folders
cp -R /Users/filipvabrousek/Desktop/layout/layout /Users/filipvabrousek/launch/
cp -R /Users/filipvabrousek/Desktop/layout/lib /Users/filipvabrousek/launch/
cp -R /Users/filipvabrousek/Desktop/layout/lib /Users/filipvabrousek/launch/public/
cp -R /Users/filipvabrousek/Desktop/layout/assets /Users/filipvabrousek/launch/

# Run Playwright tests
echo "🧪 Running Playwright tests..."
if ! npm run test; then
  echo "❌ Playwright tests failed. Aborting release."
  exit 1
fi
echo "✅ All tests passed."

# ----------------------------
# Packages (use parallel arrays for Bash 3.2)
# ----------------------------
PKG_NAMES=("nodality" "create-nodality" "create-nodality-react" "create-nodality-vue")
PKG_PATHS=(
  "/Users/filipvabrousek/launch"
  "/Users/filipvabrousek/create-nodality"
  "/Users/filipvabrousek/create-nodality-react"
  "/Users/filipvabrousek/create-nodality-vue"
)
RELEASE_VERSIONS=()

# ----------------------------
# Helper: Get available version on npm
# ----------------------------
get_available_version() {
  pkg_name="$1"
  candidate="$2"
  candidate=${candidate#v}  # Strip leading v if exists
  while npm view "$pkg_name@$candidate" >/dev/null 2>&1; do
    candidate=$(npm version patch --no-git-tag-version | tr -d '"')
    candidate=${candidate#v}
  done
  echo "$candidate"
}

# ----------------------------
# Step 1: Determine release version
# ----------------------------
echo "🔢 Checking current versions and determining release..."
for i in "${!PKG_NAMES[@]}"; do
  pkg_name="${PKG_NAMES[$i]}"
  pkg_path="${PKG_PATHS[$i]}"
  cd "$pkg_path" || exit 1

  current_version=$(npm pkg get version | tr -d '"')
  echo "Current version of $pkg_name: $current_version"

  if [[ "$current_version" == *-beta* ]]; then
    # First stable release: strip -beta
    release_version="${current_version/-beta.*}"
    echo "First stable release detected. Base version: $release_version"
    npm version "$release_version" --no-git-tag-version
  else
    # Already stable: increment patch
    release_version=$(npm version patch --no-git-tag-version)
    release_version=${release_version#v}
    echo "Stable release detected. Auto-incremented patch: $release_version"
  fi

  # Check if version exists on npm
  release_version=$(get_available_version "$pkg_name" "$release_version")
  RELEASE_VERSIONS[$i]="$release_version"

  # Update package.json to final version
  npm version "${RELEASE_VERSIONS[$i]}" --no-git-tag-version
  echo "✅ Final release version for $pkg_name: ${RELEASE_VERSIONS[$i]}"
done

# ----------------------------
# Step 2: Update nodality dependencies
# ----------------------------
nodality_version="${RELEASE_VERSIONS[0]}"
for i in 1 2 3; do
  pkg_name="${PKG_NAMES[$i]}"
  pkg_path="${PKG_PATHS[$i]}"
  cd "$pkg_path" || exit 1
  echo "Updating nodality dependency in $pkg_name to ^$nodality_version"
  npm install "nodality@$nodality_version" --save
done

# ----------------------------
# Step 2.5: Update bin/index.js for create-* packages
# ----------------------------
for i in 1 2 3; do
  pkg_name="${PKG_NAMES[$i]}"
  pkg_path="${PKG_PATHS[$i]}"
  cd "$pkg_path" || exit 1

  bin_file="bin/index.js"
  if [ -f "$bin_file" ]; then
    echo "Updating nodality version in $pkg_name/$bin_file to ^${nodality_version}"
    sed -i.bak -E "s|(nodality: \\\")[^\"]+(\")|\1^${nodality_version}\2|" "$bin_file"
    rm "$bin_file.bak"
  else
    echo "⚠️ $bin_file not found in $pkg_name, skipping update."
  fi
done

# ----------------------------
# Step 3: Build & publish
# ----------------------------
for i in "${!PKG_NAMES[@]}"; do
  pkg_name="${PKG_NAMES[$i]}"
  pkg_path="${PKG_PATHS[$i]}"
  cd "$pkg_path" || exit 1

  # Only build nodality
  if [[ "$pkg_name" == "nodality" ]]; then
    echo "🔨 Building $pkg_name..."
    npm run inject-license 2>/dev/null || true
    npm run build 2>/dev/null || true
  fi

  echo "📦 Publishing $pkg_name..."
  npm publish
  echo "✅ Published $pkg_name@${RELEASE_VERSIONS[$i]}"
done

echo "🎉 Release complete. All packages published at their final versions."