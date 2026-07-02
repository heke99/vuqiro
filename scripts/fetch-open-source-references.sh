#!/usr/bin/env bash
set -euo pipefail

mkdir -p references/open-source
cd references/open-source

clone_or_update() {
  local repo_url="$1"
  local dir_name="$2"

  if [ -d "$dir_name/.git" ]; then
    echo "Updating $dir_name"
    git -C "$dir_name" pull --ff-only || true
  else
    echo "Cloning $repo_url"
    git clone --depth 1 "$repo_url" "$dir_name" || true
  fi
}

clone_or_update https://github.com/TheWidlarzGroup/react-native-video-feed.git react-native-video-feed
clone_or_update https://github.com/TheWidlarzGroup/react-native-video.git react-native-video
clone_or_update https://github.com/RevenueCat/react-native-purchases.git react-native-purchases
clone_or_update https://github.com/joinloops/loops-server.git loops-server
clone_or_update https://github.com/syncloudsoftech/taktak.git taktak
clone_or_update https://github.com/Chocobozzz/PeerTube.git peertube
clone_or_update https://github.com/mediacms-io/mediacms.git mediacms

echo "Open-source references downloaded."
echo "Review docs/legal/source-usage.md before using anything from these repositories."
