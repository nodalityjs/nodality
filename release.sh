cp -R /Users/filipvabrousek/Desktop/layout/layout /Users/filipvabrousek/launch/
cp -R /Users/filipvabrousek/Desktop/layout/lib /Users/filipvabrousek/launch/
current_version=$(grep -o '"version": "[^"]*"' package.json | sed -E 's/"version": "([0-9]+\.[0-9]+\.[0-9]+-beta\.)([0-9]+)"/\2/'); \
next_version=$((current_version + 1)); \
sed -i '' -E "s/(\"version\": \"[0-9]+\.[0-9]+\.[0-9]+-beta\.)[0-9]+\"/\1${next_version}\"/" package.json

npm publish