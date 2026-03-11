#!/bin/bash

# Set XDG_CONFIG_HOME to a local directory within the project
# This bypasses the permission issue with ~/.config owned by root
export XDG_CONFIG_HOME="$PWD/.config"

# Create the local config directory if it doesn't exist
mkdir -p "$XDG_CONFIG_HOME"

echo "Using local configuration directory: $XDG_CONFIG_HOME"
echo "Starting build..."

# Run the flutter build command
flutter build apk --release
