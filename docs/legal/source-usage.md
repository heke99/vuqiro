# Source Usage

## Policy

Vuqiro may use permissive open-source dependencies when documented. GPL/AGPL projects are reference-only unless Diversa Solutions LLC makes a separate written licensing decision.

| Source | License | Use | Risk | Notes |
|---|---|---|---|---|
| TheWidlarzGroup/react-native-video-feed | MIT | Reference / possible dependency | Low | Feed architecture, preloading, video UX. Do not copy demo UI/assets. |
| TheWidlarzGroup/react-native-video | MIT | Possible dependency | Low | Future HLS/video player. Batch 1 uses placeholders. |
| joinloops/loops-server | AGPLv3 | Reference only | High | Study short-video backend patterns. Do not copy code. |
| syncloudsoftech/taktak | GPL-3.0 | Reference only | High | Feature checklist only. Do not copy app/backend/admin code. |
| Chocobozzz/PeerTube | AGPL-3.0 | Reference only | High | Video/moderation/federation inspiration. Do not copy code. |
| mediacms-io/mediacms | AGPL-3.0 | Reference only | High | Media/admin inspiration. Do not copy code. |
| RevenueCat/react-native-purchases | MIT | Future dependency | Low | IAP/subscriptions SDK. Batch 1 scaffold only. |

## Reference fetch

Run:

```bash
pnpm fetch:references
```

If a clone fails, document it here before use.
