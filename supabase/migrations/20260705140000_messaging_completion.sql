-- Messaging completion: message reporting, message notifications and
-- conversation ordering. The conversations/conversation_members/messages
-- tables already exist (safety-ops migration); this closes the gaps needed
-- for a working DM product.
-- Legal owner: Diversa Solutions LLC

-- Messages become reportable targets.
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('video','comment','profile','creator','message'));

alter table public.moderation_cases drop constraint moderation_cases_target_type_check;
alter table public.moderation_cases
  add constraint moderation_cases_target_type_check
  check (target_type in ('video','comment','profile','creator','message'));

-- New-message notifications with their own preference toggle.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('new_follower','new_comment','comment_reply','creator_new_video','subscriber_drop','subscription_active','subscription_cancelled','coin_received','video_unlocked','payout_status','moderation_warning','system_notice','new_message'));

alter table public.notification_preferences
  add column messages boolean not null default true;

-- Conversation lists order by latest activity.
alter table public.conversations
  add column last_message_at timestamptz;

create index conversations_last_message_idx on public.conversations (last_message_at desc nulls last);
