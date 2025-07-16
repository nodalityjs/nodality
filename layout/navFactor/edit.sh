#!/bin/bash

# Loop through all .js files in the current directory
for file in ./*.js; do
    # Skip if no .js files are found
    [ -e "$file" ] || continue

    # Extract the class name using a basic regex and awk
    class_name=$(grep -o 'class [a-zA-Z_][a-zA-Z0-9_]*' "$file" | awk '{print $2}')

    # Check if the class name was found
    if [ -z "$class_name" ]; then
        echo "No class definition found in $file. Skipping..."
        continue
    fi

    # Temporary file to store the output
    temp_file=$(mktemp)

    # Preserve class content and add imports/exports
    {
        echo 'import {Animator} from "./animator.js";'
        echo
        cat "$file"
        echo
        echo "window.$class_name = $class_name;"
        echo "export { $class_name };"
    } > "$temp_file"

    # Replace the original file with the transformed content
    mv "$temp_file" "$file"

    echo "Transformed: $file"
done

echo "All .js files in the current folder have been processed."


# ./edit.sh in your folder, only ONE class per file!