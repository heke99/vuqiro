#!/usr/bin/env bash
set -euo pipefail

mkdir -p references/open-source
cd references/open-source

clone_or_skip() {
  local repo="$1"
  local dir="$2"
  if [ -d "$dir" ]; then
    echo "✓ $dir already exists, skipping"
  else
    echo "Cloning $repo into $dir"
    git clone --depth 1 "$repo" "$dir" || echo "⚠ Failed to clone $repo. Continue and document manually."
  fi
}

clone_or_skip https://github.com/TheWidlarzGroup/react-native-video-feed.git react-native-video-feed
clone_or_skip https://github.com/TheWidlarzGroup/react-native-video.git react-native-video
clone_or_skip https://github.com/joinloops/loops-server.git loops-server
clone_or_skip https://github.com/syncloudsoftech/taktak.git taktak
clone_or_skip https://github.com/Chocobozzz/PeerTube.git PeerTube
clone_or_skip https://github.com/mediacms-io/mediacms.git mediacms
clone_or_skip https://github.com/RevenueCat/react-native-purchases.git react-native-purchases

echo "Open-source references fetch finished. Review docs/legal/source-usage.md before using anything."
