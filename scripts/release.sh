#!/usr/bin/env bash
# Starts a release: raises the version, commits, tags and pushes. GitHub Actions then builds and
# publishes the installers (.github/workflows/release.yml). Asks for every name before pushing.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash your changes first; a release is built from what's on GitHub." >&2
  exit 1
fi

current=$(node -p 'require("./package.json").version')
echo "Current version: $current"
read -rp "New version (e.g. 1.0.1): " version
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must look like 1.2.3" >&2
  exit 1
fi
if [[ "$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -1)" != "$version" || "$version" == "$current" ]]; then
  echo "New version must be higher than $current, or installed apps won't update to it." >&2
  exit 1
fi

read -rp "Tag name [v$version]: " tag
tag=${tag:-v$version}
if [[ "$tag" != v* ]]; then
  echo "Tag must start with v; the workflow only runs for v tags." >&2
  exit 1
fi
read -rp "Release title [$tag]: " title
title=${title:-$tag}
read -rp "Commit message [Version $version]: " message
message=${message:-Version $version}

echo
echo "Version:  $current -> $version"
echo "Commit:   $message"
echo "Tag:      $tag"
echo "Release:  $title"
read -rp "Commit, tag and push to GitHub? [y/N] " ok
[[ "$ok" == [yY] ]] || { echo "Nothing changed."; exit 0; }

npm version "$version" --no-git-tag-version >/dev/null
node -e '
  const fs = require("fs"), p = "src-tauri/tauri.conf.json";
  const c = JSON.parse(fs.readFileSync(p)); c.version = process.argv[1];
  fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");' "$version"
node -e '
  const fs = require("fs"), p = "src-tauri/Cargo.toml";
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^version = ".*"$/m, `version = "${process.argv[1]}"`));' "$version"
(cd src-tauri && cargo update --workspace --offline --quiet)

git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "$message"
git tag -a "$tag" -m "$title"
git push origin HEAD
git push origin "$tag"
echo
echo "pushed and building on actions tab: https://github.com/Chrisandyu/canvas/actions"
