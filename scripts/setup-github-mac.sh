#!/usr/bin/env bash
# Run once on your Mac: bash scripts/setup-github-mac.sh
set -euo pipefail

GITHUB_USER="ew3adam"
EMAIL="${GITHUB_USER}@users.noreply.github.com"

echo "→ Git identity ($GITHUB_USER / GitHub noreply email)"
git config --global user.name "$GITHUB_USER"
git config --global user.email "$EMAIL"
git config --global init.defaultBranch main

SSH_DIR="$HOME/.ssh"
KEY="$SSH_DIR/id_ed25519_github"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [[ -f "$KEY" ]]; then
  echo "→ SSH key already exists: $KEY (skipping ssh-keygen)"
else
  echo "→ Creating SSH key…"
  ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY" -N ""
fi

echo "→ Adding key to ssh-agent (macOS Keychain if available)…"
eval "$(ssh-agent -s)"
if ssh-add --apple-use-keychain "$KEY" 2>/dev/null; then
  :
else
  ssh-add "$KEY"
fi

echo ""
echo "=== Add this key on GitHub (one time) ==="
echo "1. Open: https://github.com/settings/keys"
echo "2. New SSH key → paste the line below → Save"
echo ""
cat "${KEY}.pub"
echo ""
echo "=== Test ==="
echo "Run: ssh -T git@github.com"
echo "(type yes if asked about fingerprint)"
echo ""
echo "Clone with SSH: git clone git@github.com:${GITHUB_USER}/fishing-app.git"
