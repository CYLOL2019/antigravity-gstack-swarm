#!/usr/bin/env bash
# One-command macOS & Linux installer for Antigravity GStack Swarm (Full Runtime Edition).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
GSTACK_REPO_URL="${GSTACK_REPO_URL:-https://github.com/garrytan/gstack.git}"
GSTACK_DEST="${GSTACK_ROOT:-$HOME/.gemini/gstack}"
PLUGIN_DEST="$HOME/.gemini/config/plugins/gstack-swarm"

echo "==> [1/6] Checking prerequisites (Node.js >= 20, git, jq, Bun)..."
command -v node >/dev/null 2>&1 || { echo "Error: Node.js (>= 20) is required." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Error: git is required." >&2; exit 1; }

if ! command -v bun >/dev/null 2>&1; then
  echo "    Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "==> [2/6] Cloning or updating garrytan/gstack in $GSTACK_DEST..."
mkdir -p "$(dirname "$GSTACK_DEST")"
if [ -d "$GSTACK_DEST/.git" ]; then
  git -C "$GSTACK_DEST" pull --ff-only
else
  rm -rf "$GSTACK_DEST"
  git clone --depth 1 "$GSTACK_REPO_URL" "$GSTACK_DEST"
fi

echo "==> [3/6] Injecting Antigravity Full-Tier Host & Zero-Trust Swarm Lock Engine..."
cp -f "$REPO_ROOT/runtime/hosts/agy.ts" "$GSTACK_DEST/hosts/agy.ts"
cp -f "$REPO_ROOT/runtime/bin/gstack-swarm-lock.mjs" "$GSTACK_DEST/bin/gstack-swarm-lock.mjs"
cp -f "$REPO_ROOT/runtime/bin/gstack-dispatch.mjs" "$GSTACK_DEST/bin/gstack-dispatch.mjs"
chmod +x "$GSTACK_DEST/bin/gstack-swarm-lock.mjs" "$GSTACK_DEST/bin/gstack-dispatch.mjs"

mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/gstack" <<'EOF'
#!/usr/bin/env bash
exec node "${GSTACK_ROOT:-$HOME/.gemini/gstack}/bin/gstack-dispatch.mjs" "$@"
EOF
chmod +x "$HOME/.local/bin/gstack"

echo "==> [4/6] Installing dependencies & compiling native binaries + 64 upstream skills..."
(
  cd "$GSTACK_DEST"
  bun install
  echo "agy" > .gstack-installed-hosts
  bash scripts/build.sh
  bun run build:diagram-render
  bun --no-env-file --config=/dev/null scripts/gen-skill-docs.ts --host agy
  if [ "${SKIP_BROWSER_DOWNLOAD:-0}" != "1" ]; then
    npx playwright install chromium
  fi
)

echo "==> [5/6] Deploying global Antigravity plugin to $PLUGIN_DEST..."
rm -rf "$PLUGIN_DEST"
mkdir -p "$(dirname "$PLUGIN_DEST")"
cp -R "$REPO_ROOT/plugin" "$PLUGIN_DEST"

for skill_dir in "$GSTACK_DEST"/.agy/skills/*; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  dst="$PLUGIN_DEST/skills/$skill_name"
  rm -rf "$dst"
  cp -R "$skill_dir" "$dst"

  base_name="${skill_name#gstack-}"
  src_skill="$GSTACK_DEST/$base_name"
  if [ -d "$src_skill" ]; then
    for sub in references templates specialists sections; do
      if [ -d "$src_skill/$sub" ]; then
        mkdir -p "$dst/$sub"
        for f in "$src_skill/$sub"/*; do
          [ -f "$f" ] || continue
          case "$f" in *.tmpl) continue ;; esac
          [ -f "$dst/$sub/$(basename "$f")" ] || cp "$f" "$dst/$sub/"
        done
      fi
    done
  fi
  printf 'gstack-swarm' > "$dst/.gstack-owned"
done

(
  cd "$GSTACK_DEST"
  . bin/gstack-state-root.sh
  . bin/gstack-install-registry.sh
  gstack_state_root_select
  GSTACK_STATE_ROOT="$_gstack_sr_root"
  VER="$(tr -d '\r\n' < VERSION)"
  gstack_install_registry_upsert "agy" "global" "-" "$PLUGIN_DEST/skills" "$GSTACK_DEST" "$GSTACK_DEST" "$VER" "true" "committed"
)

echo "==> [6/6] Running verification tests & gstack doctor..."
(cd "$REPO_ROOT" && node --test tests/*.test.mjs)
"$HOME/.local/bin/gstack" doctor
echo "SUCCESS! Antigravity GStack Swarm is installed and active (ensure ~/.local/bin is on your PATH)."
