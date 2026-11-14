#!/usr/bin/env bash
#
# Deploy the latest static app (index / script / styles) to the gh-pages branch.
#
# Flow:
#   1. Precheck: git working tree must be clean (no pending work).
#   2. Switch to gh-pages.
#   3. Pull the three source files in from master.
#   4. Commit them with an incremental, dated/time-stamped message.
#   5. Push to origin/gh-pages.
#   6. Switch back to master.
#
set -euo pipefail

cd "$(dirname "$0")"

MAIN_BRANCH="master"
DEPLOY_BRANCH="gh-pages"
FILES=(index.html script.js styles.css C2.wav C3.wav C4.wav C5.wav C6.wav C7.wav)

# --- 1. Precheck -----------------------------------------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: not inside a git repository" >&2
  exit 1
fi

if ! git diff --quiet --ignore-submodules HEAD; then
  echo "error: working tree has pending work (modified tracked files). Commit or stash before deploying." >&2
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "error: there are staged but uncommitted changes. Resolve them first." >&2
  exit 1
fi

# Untracked files are NOT covered by the git diff checks above, so catch them
# explicitly. An empty --porcelain output means nothing is pending anywhere.
if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree has untracked or pending files. Clean them up before deploying." >&2
  echo "Pending files:" >&2
  git status --porcelain >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$MAIN_BRANCH" ]; then
  echo "error: expected to be on '$MAIN_BRANCH' but found '$current_branch'." >&2
  exit 1
fi

echo "Precheck OK - working tree is clean, on $MAIN_BRANCH."

# --- 2. Switch to gh-pages -------------------------------------------------------
git checkout "$DEPLOY_BRANCH"

# --- 3. Pull the latest source files in from master ------------------------------
# Extract each file from master's committed tree into the working dir on gh-pages.
for file in "${FILES[@]}"; do
  git show "$MAIN_BRANCH:$file" > "$file"
done

# --- 4. Stage and commit with an incremental, dated message -----------------------
git add "${FILES[@]}"

# Only commit if there is something new (files may already be in sync).
if git diff --cached --quiet; then
  echo "Nothing to commit - source files already match $MAIN_BRANCH."
  git checkout "$MAIN_BRANCH"
  echo "Returned to $MAIN_BRANCH (no deploy needed)."
  exit 0
fi

stamp="$(date +"%Y-%m-%d %H:%M:%S")"
message="Deploy frontend update - $stamp"

git commit -m "$message"

# --- 5. Push to gh-pages -----------------------------------------------------------
git push origin "$DEPLOY_BRANCH"

# --- 6. Return to main branch -------------------------------------------------------
git checkout "$MAIN_BRANCH"

echo "Done. Deployed to $DEPLOY_BRANCH and returned to $MAIN_BRANCH."

