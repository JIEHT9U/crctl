#!/usr/bin/env bash
set -e

BINARY_NAME="crctl"
INSTALL_DIR="$HOME/.local/bin"
GITHUB_URL="https://raw.githubusercontent.com/JIEHT9U/crctl/main/dist/index.js"

echo "🚀 Installing ${BINARY_NAME}..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "   Install it: https://nodejs.org/"
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download
echo "   Downloading..."
curl -fsSL "$GITHUB_URL" -o "$INSTALL_DIR/$BINARY_NAME"

# Make executable
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Check if PATH needs updating
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  Adding $INSTALL_DIR to PATH..."
    
    SHELL_NAME=$(basename "$SHELL")
    if [ "$SHELL_NAME" = "fish" ]; then
        echo "fish_add_path $INSTALL_DIR" >> "$HOME/.config/fish/config.fish"
        echo "   Added to ~/.config/fish/config.fish"
    elif [ "$SHELL_NAME" = "zsh" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
        echo "   Added to ~/.zshrc"
    else
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        echo "   Added to ~/.bashrc"
    fi
fi

echo ""
echo "✅ ${BINARY_NAME} installed successfully!"
echo ""
echo "   Run: ${BINARY_NAME} --help"
echo ""