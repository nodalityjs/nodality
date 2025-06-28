#!/bin/bash

# Loop through all .js files in the current directory
for file in ./*.js; do
    # Skip if no .js files are found
    [ -e "$file" ] || continue

    # Use a temporary file to store the modified content
    temp_file=$(mktemp)

    # Remove lines containing "window.<ClassName> = <ClassName>;"
    grep -vE 'window\.[a-zA-Z_][a-zA-Z0-9_]* = [a-zA-Z_][a-zA-Z0-9_]*;' "$file" > "$temp_file"

    # Replace the original file with the updated content
    mv "$temp_file" "$file"

    echo "Processed: $file"
done

echo "All .js files in the current folder have been processed to remove window assignments."
