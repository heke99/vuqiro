# Copyright & Takedown Policy — Outline

> These are product and implementation outlines, not final legal advice.
> Final legal documents must be reviewed by a qualified attorney before launch.

Owner: Diversa Solutions LLC · Product: Vuqiro

## 1. Scope

Applies to all user-uploaded content (videos, thumbnails, captions, audio,
comments). Users must own or license everything they upload, including music.

## 2. Submitting a takedown notice

Rights holders can report infringement via:
- the in-app report flow (reason: **Copyright**), or
- email to the designated agent (SUPPORT_EMAIL), including: identification of
  the copyrighted work, the infringing URL/video ID, contact information,
  a good-faith statement, a statement of accuracy under penalty of perjury,
  and a physical or electronic signature (DMCA § 512(c)(3) elements).

## 3. Processing

1. Copyright reports create moderation cases (implemented; reason
   `copyright`).
2. Valid notices lead to `remove_content`; the uploader is notified with the
   reason (implemented via moderation notifications).
3. The removal is recorded in the immutable audit log.

## 4. Counter-notice

Uploaders may appeal (implemented via the in-app appeal flow) or submit a
formal counter-notice with: identification of the removed material, a
statement under penalty of perjury of good-faith belief of mistake, consent
to jurisdiction, and a signature. Content may be restored 10–14 business days
after a valid counter-notice unless the claimant files an action.

## 5. Repeat infringers

Accounts with repeated valid copyright removals are terminated. The
moderation-warnings counter and ban tooling implement this; the strike
threshold (recommended: 3 valid strikes / 12 months) is finalized with
counsel.

## 6. Misrepresentation

Knowingly false takedown or counter-notice claims may create liability for
the sender. Abusive reporters are handled through the fraud-signals pipeline.

## Implementation status

- [x] Copyright report reason in all report flows
- [x] Case pipeline + removal + uploader notification + audit log
- [x] Appeal flow
- [ ] Designated-agent registration (US Copyright Office) — owner action
- [ ] Formal counter-notice intake form — before launch
