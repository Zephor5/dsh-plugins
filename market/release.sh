#!/usr/bin/env bash
set -euo pipefail

# Include drafts so a rerun can finish an interrupted asset upload.
releases=$(gh api --paginate --slurp "repos/$GITHUB_REPOSITORY/releases?per_page=100")
site=market/site
packages=$(jq -r '.plugins[].name' "$site/index.json")
for package in $packages; do
  metadata="$site/registry/$package"
  version=$(jq -er '."dist-tags".latest' "$metadata")
  tag="$package@$version"
  url=$(jq -er --arg v "$version" '.versions[$v].dist.tarball' "$metadata")
  filename=${url##*/}
  archive="$site/registry/-/$filename"
  release=$(jq -c --arg tag "$tag" '.[][] | select(.tag_name == $tag)' <<< "$releases")

  if [[ -n "$release" && $(jq -r '.draft' <<< "$release") == false ]]; then
    digest="sha256:$(shasum -a 256 "$archive" | cut -d' ' -f1)"
    if ! jq -e --arg file "$filename" --arg digest "$digest" \
      'any(.assets[]; .name == $file and .digest == $digest)' <<< "$release" >/dev/null; then
      echo "::error::$tag already exists with different assets. Bump the plugin version to release a changed package."
      exit 1
    fi
    echo "Already released $tag"
    continue
  fi

  directory=$(jq -er --arg name "$package" '.plugins[] | select(.name == $name) | .repository.directory' "$site/index.json")
  target=$(git log -1 --format=%H HEAD -- "$directory")
  existing_tag=$(git rev-parse --verify --quiet "refs/tags/$tag^{commit}" || true)
  if [[ -n "$existing_tag" && "$existing_tag" != "$target" ]]; then
    echo "::error::$tag already points to a different commit."
    exit 1
  fi

  if [[ -z "$release" ]]; then
    flags=(--draft --target "$target" --title "$tag" --notes "DSH plugin package for $tag.")
    if [[ "${version%%+*}" == *-* ]]; then flags+=(--prerelease); fi
    gh release create "$tag" "${flags[@]}"
  elif [[ $(jq -r '.target_commitish' <<< "$release") != "$target" ]]; then
    echo "::error::Existing draft for $tag has a different target."
    exit 1
  fi
  gh release upload "$tag" "$archive" --clobber
  gh release edit "$tag" --draft=false --latest=false
done
