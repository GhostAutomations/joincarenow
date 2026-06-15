#!/usr/bin/env bash
# Join Care Now — apply pending migrations + deploy, in one go.
# Usage: ship   (after setting up the alias) or:  bash ship.sh
set -uo pipefail

cd "$(dirname "$0")" || exit 1

# Clear any stale git locks (harmless if none exist).
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true

echo "→ Applying database migrations…"
npx supabase db push --yes || { echo "✗ Migration failed — not deploying."; exit 1; }

echo "→ Pushing code to deploy…"
git push || { echo "✗ git push failed."; exit 1; }

echo "✓ Done — migrations applied and code pushed. Vercel is deploying."
