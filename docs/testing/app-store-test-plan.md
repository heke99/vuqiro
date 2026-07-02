# App Store / Google Play Test Plan

Run on the production-profile build before every submission
(TestFlight / Play internal testing).

## Review-critical paths

| # | Test | Expected |
|---|---|---|
| 1 | Fresh install → first launch | Splash + welcome; no crash; no forced login to browse |
| 2 | Create account | Terms/privacy/guidelines acceptance required and stored |
| 3 | Sign in with the review account | Feed loads with content immediately |
| 4 | Report a video, a comment and a profile | All three flows submit with confirmation |
| 5 | Block a user | Their content disappears |
| 6 | Community guidelines | Reachable from settings without login barriers |
| 7 | Account deletion | Request flow completes; cancellable; described accurately |
| 8 | Restore purchases | Visible in Settings; completes without error |
| 9 | Subscription purchase (sandbox) | Store sheet; correct price; success state |
| 10 | Coin purchase (sandbox) | Same |
| 11 | Locked content | Unlock + subscribe paths work with the seeded account |
| 12 | Legal links | Terms, privacy, guidelines, creator terms, payout terms all open |
| 13 | Support contact | support@vuqiro.app visible in settings |

## Platform checks

| # | Test | Expected |
|---|---|---|
| 14 | Permission prompts (photos/camera/mic) | Fire only when uploading; copy matches app.json |
| 15 | Background/foreground cycling | Video pauses/resumes correctly |
| 16 | Offline launch | App opens; feed shows a graceful empty/mocked state, no crash |
| 17 | iPad (if enabled) / large Android | Layout usable (portrait) |
| 18 | Deep link `vuqiro://` | Opens the app |
| 19 | Dark status bar/system UI | Consistent with the dark theme |

## Regression sweep

- All 6 tabs render; every modal opens and closes
- Creator studio: all 6 sections
- No console errors in the dev-client build during the sweep

Record results (build number, device matrix, date, tester) in the
go-live checklist before submitting.
