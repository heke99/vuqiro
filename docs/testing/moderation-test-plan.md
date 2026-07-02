# Moderation Test Plan

Runs against staging with two consumer accounts (A: reporter, B: creator)
plus a moderator admin account.

## Reporting

| # | Test | Expected |
|---|---|---|
| 1 | A reports B's video (spam) | Case created (medium), report attached |
| 2 | 4 more distinct accounts report it | Case report_count=5, priority high; fraud signal `repeated_reports` |
| 3 | A reports a comment (harassment) | Comment case created |
| 4 | A reports a profile (minor_safety) | Case priority **critical** immediately |
| 5 | A submits 21 reports in an hour | 21st → 429 rate limited |

## Decisions & enforcement

| # | Test | Expected |
|---|---|---|
| 6 | Moderator: limit_distribution on video | moderation_status=limited; heavily downranked but visible; owner notified |
| 7 | Moderator: remove_content | Video gone from all feeds/search instantly; owner notified with appeal pointer |
| 8 | Moderator: age_restrict | 18+ interstitial in feed |
| 9 | Moderator: suspend_user on B | B's sign-in works but every mutating call → 403 "Account is suspended" |
| 10 | Moderator: ban_user on B | B's videos + comments blocked platform-wide; B cannot upload/comment/like |
| 11 | Moderator: hold_payout via case | Active hold; B's payouts + payable ledger → held; excluded from batches |
| 12 | Moderator: restore_content | Video back in feed; status ready |
| 13 | Every action above | audit_logs entry + moderation_actions record exists |

## Appeals

| # | Test | Expected |
|---|---|---|
| 14 | B appeals the removal from creator studio | Case status=appealed; appeal message attached; case back in queue |
| 15 | A (non-owner) tries to appeal B's case | 403 |
| 16 | 6th appeal in a day | 429 |

## Blocking

| # | Test | Expected |
|---|---|---|
| 17 | A blocks B | B's videos vanish from A's feeds/discover/comments immediately |
| 18 | A unblocks B | Content visible again |

## Upload safety

| # | Test | Expected |
|---|---|---|
| 19 | Upload with flagged caption | status under_review; not in feed until approved |
| 20 | 11th upload within an hour | 429 |
