#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-${ROOT_DIR}/dist_static}"
SITE_PUBLIC_DIR="${SITE_PUBLIC_DIR:-${ROOT_DIR}/../rue-js-site/public}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: update static site public assets}"

if [ ! -d "$SITE_PUBLIC_DIR" ]; then
	echo "Skip: site public directory does not exist: $SITE_PUBLIC_DIR"
	exit 0
fi

if [ ! -d "$DIST_DIR" ]; then
	echo "Error: static dist directory does not exist: $DIST_DIR" >&2
	exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
	echo "Error: rsync is required." >&2
	exit 1
fi

if ! git -C "$SITE_PUBLIC_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "Error: $SITE_PUBLIC_DIR is not inside a git repository." >&2
	exit 1
fi

CURRENT_BRANCH="$(git -C "$SITE_PUBLIC_DIR" branch --show-current)"
if [ "$CURRENT_BRANCH" != "main" ]; then
	echo "Error: target repository must be on main branch, current branch is: ${CURRENT_BRANCH:-detached HEAD}" >&2
	exit 1
fi

if ! git -C "$SITE_PUBLIC_DIR" diff --cached --quiet; then
	echo "Error: target repository already has staged changes. Please commit or unstage them first." >&2
	exit 1
fi

echo "Cleaning $SITE_PUBLIC_DIR, preserving _redirects..."
find "$SITE_PUBLIC_DIR" -mindepth 1 -maxdepth 1 \
	! -name '_redirects' \
	! -name '.git' \
	-exec rm -rf {} +

echo "Copying $DIST_DIR contents to $SITE_PUBLIC_DIR..."
rsync -a --exclude '_redirects' "$DIST_DIR"/ "$SITE_PUBLIC_DIR"/

echo "Staging static site public changes..."
git -C "$SITE_PUBLIC_DIR" add .

if git -C "$SITE_PUBLIC_DIR" diff --cached --quiet; then
	echo "No changes to commit."
	exit 0
fi

git -C "$SITE_PUBLIC_DIR" commit -m "$COMMIT_MESSAGE"
git -C "$SITE_PUBLIC_DIR" push --force origin main
