#!/usr/bin/env bash
# =============================================================================
# fake_day_commits.sh
#
# Creates one git commit per logical change group, with timestamps spread
# across a working day to simulate a natural development workflow.
#
# Usage:
#   ./scripts/fake_day_commits.sh [YYYY-MM-DD]
#
# If no date is provided, today's date is used.
# The script must be run from the repository root.
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}  →${RESET} $*"; }
success() { echo -e "${GREEN}  ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}  ⚠${RESET} $*"; }
error()   { echo -e "${RED}  ✗${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }

# ── Resolve repo root ─────────────────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  error "Not inside a git repository."
  exit 1
}
cd "$REPO_ROOT"

# ── Date parameter ────────────────────────────────────────────────────────────
COMMIT_DATE="${1:-$(date +%Y-%m-%d)}"

# Validate format
if ! date -d "$COMMIT_DATE" &>/dev/null 2>&1; then
  error "Invalid date: '$COMMIT_DATE'. Use YYYY-MM-DD format."
  exit 1
fi

header "🗓  Simulating commits for: ${BOLD}${COMMIT_DATE}${RESET}"
echo   "   Repository: ${REPO_ROOT}"
echo

# ── Helper: build a full ISO-8601 timestamp with slight jitter ────────────────
# Usage: make_ts HH:MM [+/-jitter_minutes]
make_ts() {
  local hhmm="$1"
  local jitter="${2:-0}"
  local base_epoch
  base_epoch=$(date -d "${COMMIT_DATE} ${hhmm}:00" +%s)
  # Add random jitter within ±jitter seconds (max 2 min)
  local rand_offset=$(( (RANDOM % (jitter * 60 + 1)) - (jitter * 30) ))
  local final_epoch=$(( base_epoch + rand_offset ))
  date -d "@${final_epoch}" "+%Y-%m-%dT%H:%M:%S %z"
}

# ── Helper: commit a group of files ──────────────────────────────────────────
# Usage: commit_group <timestamp> <message> <file_or_glob>...
commit_group() {
  local ts="$1"; shift
  local msg="$1"; shift
  local files=("$@")

  local staged=0

  for pattern in "${files[@]}"; do
    # Try both git add (tracked/untracked) and git rm (deleted)
    if git ls-files --error-unmatch "$pattern" &>/dev/null 2>&1; then
      # File is tracked — add or remove
      git add "$pattern" 2>/dev/null && (( staged++ )) || true
    else
      # Might be untracked new file or a glob
      git add -- "$pattern" 2>/dev/null && (( staged++ )) || true
    fi
  done

  # Check if there's actually something staged
  if ! git diff --cached --quiet; then
    GIT_AUTHOR_DATE="$ts" GIT_COMMITTER_DATE="$ts" \
      git commit -m "$msg" --quiet
    success "[${ts:11:5}]  ${msg}"
  else
    warn "Nothing to stage for: ${msg}"
  fi
}

# ── Helper: commit all deletions matching a path prefix ──────────────────────
commit_deletions() {
  local ts="$1"
  local msg="$2"
  local prefix="$3"

  # Stage all deleted files under the prefix
  git ls-files --deleted | grep "^${prefix}" | xargs -r git rm --cached --quiet --
  git diff --cached --quiet && { warn "Nothing deleted under: ${prefix}  (${msg})"; return; }

  GIT_AUTHOR_DATE="$ts" GIT_COMMITTER_DATE="$ts" \
    git commit -m "$msg" --quiet
  success "[${ts:11:5}]  ${msg}"
}

# ── Helper: commit all untracked files under a directory ─────────────────────
commit_new_dir() {
  local ts="$1"
  local msg="$2"
  local dir="$3"

  git add -- "$dir" 2>/dev/null || true
  if ! git diff --cached --quiet; then
    GIT_AUTHOR_DATE="$ts" GIT_COMMITTER_DATE="$ts" \
      git commit -m "$msg" --quiet
    success "[${ts:11:5}]  ${msg}"
  else
    warn "Nothing to stage under: ${dir}  (${msg})"
  fi
}

# =============================================================================
# Commit plan — edit the timestamps and messages to taste
# =============================================================================

header "🌅  Morning session — cleanup & housekeeping"

# 09:04 — Remove submodule reference
TS=$(make_ts "09:04" 2)
commit_group "$TS" \
  "chore: remove vendor/libcss submodule" \
  ".gitmodules"

# 09:22 — Remove old vendor directory
TS=$(make_ts "09:22" 3)
git ls-files --deleted | grep "^vendor/" | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore(vendor): remove libcss vendor submodule files" --quiet
  success "[${TS:11:5}]  chore(vendor): remove libcss vendor submodule files"
else
  warn "No vendor deletions to commit"
fi

# 09:48 — Remove legacy Model SQL schema files
TS=$(make_ts "09:48" 3)
git ls-files --deleted | grep "^app/Model/sql/" | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore(model): remove legacy SQL schema and migration files" --quiet
  success "[${TS:11:5}]  chore(model): remove legacy SQL schema and migration files"
fi

# 10:07 — Remove Model NoSQL files
TS=$(make_ts "10:07" 2)
git ls-files --deleted | grep "^app/Model/nosql/" | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore(model): remove legacy NoSQL schema definitions" --quiet
  success "[${TS:11:5}]  chore(model): remove legacy NoSQL schema definitions"
fi

# 10:33 — Remove remaining Model root files
TS=$(make_ts "10:33" 2)
git ls-files --deleted | grep "^app/Model/" | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore(model): remove remaining model documentation" --quiet
  success "[${TS:11:5}]  chore(model): remove remaining model documentation"
fi

# 10:55 — Remove old apps/frontend source files
TS=$(make_ts "10:55" 3)
git ls-files --deleted | grep "^apps/frontend/src/" | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore(apps): remove old frontend application source" --quiet
  success "[${TS:11:5}]  chore(apps): remove old frontend application source"
fi

# 11:19 — Remove remaining apps/frontend config files
TS=$(make_ts "11:19" 2)
git ls-files --deleted | grep "^apps/" | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore(apps): remove old frontend config and build files" --quiet
  success "[${TS:11:5}]  chore(apps): remove old frontend config and build files"
fi

# 11:42 — Stage any remaining deletions
TS=$(make_ts "11:42" 2)
git ls-files --deleted | xargs -r git rm --cached --quiet -- 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore: clean up remaining deleted tracked files" --quiet
  success "[${TS:11:5}]  chore: clean up remaining deleted tracked files"
fi

header "☕  Afternoon session — building the new app"

# 13:12 — Project tooling & configuration
TS=$(make_ts "13:12" 3)
commit_group "$TS" \
  "chore(app/src): initialize project configuration files" \
  "app/src/package.json" \
  "app/src/package-lock.json" \
  "app/src/vite.config.ts" \
  "app/src/tsconfig.json" \
  "app/src/postcss.config.ts" \
  "app/src/tailwind.config.js" \
  "app/src/vite-env.d.ts"

# 13:38 — Entry point and global styles
TS=$(make_ts "13:38" 2)
commit_group "$TS" \
  "feat(app/src): add Vite entry point and global CSS design system" \
  "app/src/index.html" \
  "app/src/main.tsx" \
  "app/src/index.css"

# 14:04 — Core lib utilities
TS=$(make_ts "14:04" 3)
commit_group "$TS" \
  "feat(app/src): add core utilities — cn helper, query client, types" \
  "app/src/lib/utils.ts" \
  "app/src/lib/query-client.ts" \
  "app/src/lib/app-params.ts" \
  "app/src/utils/"

# 14:27 — Auth context and page not found
TS=$(make_ts "14:27" 2)
commit_group "$TS" \
  "feat(app/src): add authentication context and 404 page" \
  "app/src/lib/AuthContext.tsx" \
  "app/src/lib/PageNotFound.tsx"

# 14:51 — Mock data store
TS=$(make_ts "14:51" 3)
commit_group "$TS" \
  "feat(app/src): add in-memory metadata store with shells, collections and views" \
  "app/src/lib/mockData.ts"

# 15:14 — Shadcn/ui primitives
TS=$(make_ts "15:14" 2)
commit_new_dir "$TS" \
  "chore(app/src): add shadcn/ui component library primitives" \
  "app/src/components/ui"

# 15:33 — Layout shell
TS=$(make_ts "15:33" 2)
commit_new_dir "$TS" \
  "feat(app/src): add AppShell layout with sidebar navigation" \
  "app/src/components/layout"

# 15:51 — Content renderers
TS=$(make_ts "15:51" 2)
commit_group "$TS" \
  "feat(app/src): add content block renderers (heading, alert, richtext, divider)" \
  "app/src/components/renderer/ContentBlock.tsx"

# 16:08 — Widget renderers
TS=$(make_ts "16:08" 3)
commit_group "$TS" \
  "feat(app/src): add widget renderers — KPI, line/bar/area/pie charts" \
  "app/src/components/renderer/WidgetKPI.tsx" \
  "app/src/components/renderer/WidgetLineChart.tsx" \
  "app/src/components/renderer/WidgetPieChart.tsx"

# 16:24 — Data widget renderers
TS=$(make_ts "16:24" 2)
commit_group "$TS" \
  "feat(app/src): add data widget renderers — sortable table and kanban board" \
  "app/src/components/renderer/WidgetDataTable.tsx" \
  "app/src/components/renderer/WidgetKanban.tsx"

# 16:39 — Component dispatcher & page renderer  
TS=$(make_ts "16:39" 2)
commit_group "$TS" \
  "feat(app/src): add component dispatcher and page/shell renderer" \
  "app/src/components/renderer/ComponentRenderer.tsx" \
  "app/src/components/renderer/PageRenderer.tsx"

# 16:58 — Editor components
TS=$(make_ts "16:58" 3)
commit_new_dir "$TS" \
  "feat(app/src): add editor components — component picker, config panel, shell picker" \
  "app/src/components/editor"

# 17:14 — Error boundary component
TS=$(make_ts "17:14" 2)
commit_group "$TS" \
  "feat(app/src): add UserNotRegisteredError boundary component" \
  "app/src/components/UserNotRegisteredError.tsx"

# 17:28 — Pages
TS=$(make_ts "17:28" 3)
commit_group "$TS" \
  "feat(app/src): add Home, Preview and Editor pages" \
  "app/src/pages/Home.tsx" \
  "app/src/pages/Editor.tsx" \
  "app/src/pages/Preview.tsx"

# 17:43 — Remaining pages
TS=$(make_ts "17:43" 2)
commit_group "$TS" \
  "feat(app/src): add Collections, Views and Shells browser pages" \
  "app/src/pages/Collection.tsx" \
  "app/src/pages/Views.tsx" \
  "app/src/pages/Shells.tsx"

# 17:55 — App root and hooks
TS=$(make_ts "17:55" 2)
commit_group "$TS" \
  "feat(app/src): wire up App root with router, auth provider and query client" \
  "app/src/App.tsx" \
  "app/src/hooks/"

header "🌆  End of day — housekeeping"

# 18:03 — Repo config files
TS=$(make_ts "18:03" 2)
commit_group "$TS" \
  "chore(app/src): add gitignore, README and shadcn/ui components config" \
  "app/src/.gitignore" \
  "app/src/README.md" \
  "app/src/components.json" \
  "app/src/eslint.config.ts"

# 18:11 — Catch any remaining untracked files
TS=$(make_ts "18:11" 2)
git add --all 2>/dev/null || true
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="$TS" GIT_COMMITTER_DATE="$TS" \
    git commit -m "chore: stage remaining untracked files" --quiet
  success "[${TS:11:5}]  chore: stage remaining untracked files"
fi

# =============================================================================
echo
header "📊  Summary"
git log --oneline --since="${COMMIT_DATE} 00:00:00" --until="${COMMIT_DATE} 23:59:59" 2>/dev/null \
  | nl -ba \
  || git log --oneline -20
echo
success "All commits created for ${BOLD}${COMMIT_DATE}${RESET}"
echo -e "  Run ${YELLOW}git log --oneline${RESET} to review, or ${YELLOW}git push${RESET} when ready."
echo
