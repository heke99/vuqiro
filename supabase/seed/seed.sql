-- Vuqiro development seed. Mirrors packages/mock-data so the app looks the
-- same on mocks and on a local database. NEVER run against production.

-- ---------------------------------------------------------------------------
-- Auth users (profiles are created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'maya@example.com', '{"handle":"maya","display_name":"Maya North"}'),
  ('00000000-0000-4000-8000-000000000002', 'riven@example.com', '{"handle":"riven","display_name":"Riven Atlas"}'),
  ('00000000-0000-4000-8000-000000000003', 'noor@example.com', '{"handle":"noorbuilds","display_name":"Noor Builds"}'),
  ('00000000-0000-4000-8000-000000000004', 'sola@example.com', '{"handle":"solacooks","display_name":"Sola Cooks"}'),
  ('00000000-0000-4000-8000-000000000005', 'kai@example.com', '{"handle":"kaimoves","display_name":"Kai Moves"}'),
  ('00000000-0000-4000-8000-000000000006', 'viewer@example.com', '{"handle":"vuqiro_viewer","display_name":"Vuqiro Viewer"}'),
  ('00000000-0000-4000-8000-00000000000a', 'superadmin@vuqiro.app', '{"handle":"vuqiro_admin","display_name":"Superadmin"}')
on conflict (id) do nothing;

-- Admin user for the console
insert into public.admin_users (auth_user_id, email, display_name, role)
values ('00000000-0000-4000-8000-00000000000a', 'superadmin@vuqiro.app', 'Superadmin', 'platform_superadmin')
on conflict (auth_user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------

update public.profiles set is_creator = true, role = 'creator', bio = 'Daily edits, music moments and creator drops.'
  where handle = 'maya';
update public.profiles set is_creator = true, role = 'creator', bio = 'Travel cuts, city nights and behind-the-scenes stories.'
  where handle = 'riven';
update public.profiles set is_creator = true, role = 'creator', bio = 'Creator tools, app building and product breakdowns.'
  where handle = 'noorbuilds';
update public.profiles set is_creator = true, role = 'creator', bio = 'Fast recipes, street food hunts and kitchen experiments.'
  where handle = 'solacooks';
update public.profiles set is_creator = true, role = 'creator', bio = 'Movement, calisthenics and training with zero equipment.'
  where handle = 'kaimoves';

insert into public.creators (id, profile_id, category, verification_status, onboarding_status, monetization_enabled, tiers_enabled)
select
  ('10000000-0000-4000-8000-00000000000' || row_number() over (order by p.handle))::uuid,
  p.id,
  case p.handle when 'maya' then 'Music' when 'riven' then 'Travel' when 'noorbuilds' then 'Tech' when 'solacooks' then 'Food' else 'Fitness' end,
  case p.handle when 'noorbuilds' then 'pending' else 'verified' end,
  'completed',
  true,
  case p.handle when 'noorbuilds' then array['support'] else array['support','plus','premium'] end
from public.profiles p
where p.handle in ('maya','riven','noorbuilds','solacooks','kaimoves')
on conflict (profile_id) do nothing;

insert into public.creator_profiles (creator_id, banner_tone, storefront_headline)
select c.id,
  case p.handle when 'maya' then 'violet' when 'riven' then 'cyan' when 'noorbuilds' then 'emerald' when 'solacooks' then 'amber' else 'rose' end,
  'Support ' || p.display_name || ' on Vuqiro'
from public.creators c join public.profiles p on p.id = c.profile_id
on conflict (creator_id) do nothing;

-- ---------------------------------------------------------------------------
-- Videos (ready + visible so the feed works immediately)
-- ---------------------------------------------------------------------------

insert into public.videos (creator_id, caption, hashtags, category, visibility, status, moderation_status, coin_unlock_price, required_tier, playback_url, safety_score, like_count, comment_count, share_count, watch_count)
select c.id, v.caption, v.hashtags, v.category, v.visibility, 'ready', 'visible', v.coin_price, v.tier, v.url, v.safety, v.likes, v.comments, v.shares, v.watches
from (values
  ('maya',      'A quick moment from tonight''s session.', array['music','studio','creator'], 'Music',  'public', null::int, null::text, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 94, 12400, 382, 910, 210000),
  ('riven',     'City lights, fast cuts, no filter.', array['travel','night','cinematic'], 'Travel', 'unlock_with_coins', 100, null, null, 91, 7900, 144, 410, 84000),
  ('noorbuilds','The simplest way to structure a creator app MVP.', array['build','startup','tech'], 'Tech', 'subscribers_only', null, 'support', null, 97, 2200, 91, 88, 22000),
  ('solacooks', '3-ingredient street tacos in 60 seconds.', array['food','recipe','fast'], 'Food', 'public', null, null, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 96, 31200, 975, 2228, 480000),
  ('kaimoves',  'Full-body warmup you can do anywhere.', array['fitness','training','mobility'], 'Fitness', 'public', null, null, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 98, 14100, 440, 1007, 220000)
) as v(handle, caption, hashtags, category, visibility, coin_price, tier, url, safety, likes, comments, shares, watches)
join public.profiles p on p.handle = v.handle
join public.creators c on c.profile_id = p.id;

-- ---------------------------------------------------------------------------
-- Monetization catalog
-- ---------------------------------------------------------------------------

insert into public.monetization_packages (code, name, type, status) values
  ('creator_support', 'Creator Support', 'creator_subscription_tier', 'published'),
  ('creator_plus', 'Creator Plus', 'creator_subscription_tier', 'published'),
  ('creator_premium', 'Creator Premium', 'creator_subscription_tier', 'published'),
  ('coins_100', '100 Coins', 'coin_pack', 'published'),
  ('coins_500', '500 Coins', 'coin_pack', 'published'),
  ('coins_1200', '1,200 Coins', 'coin_pack', 'published'),
  ('coins_5000', '5,000 Coins', 'coin_pack', 'published'),
  ('boost_small', 'Small Boost', 'boost_pack', 'ready_to_publish'),
  ('boost_growth', 'Growth Boost', 'boost_pack', 'pending_store_config'),
  ('boost_launch', 'Launch Boost', 'boost_pack', 'draft')
on conflict (code) do nothing;

insert into public.monetization_package_versions
  (package_id, version_number, display_name, description, price_amount, currency, billing_period, coins_amount, bonus_coins_amount, status)
select p.id, 1, v.display_name, v.description, v.price, 'USD', v.period, v.coins, v.bonus, v.status
from (values
  ('creator_support', 'Creator Support', 'Supporter badge and basic locked posts.', 2.99, 'monthly', null::int, null::int, 'published'),
  ('creator_plus', 'Creator Plus', 'Premium videos and early drops.', 5.99, 'monthly', null, null, 'published'),
  ('creator_premium', 'Creator Premium', 'Exclusive drops and priority interaction.', 9.99, 'monthly', null, null, 'published'),
  ('coins_100', '100 Coins', 'Small starter coin pack.', 1.99, 'one_time', 100, null, 'published'),
  ('coins_500', '500 Coins', 'Most popular starter pack.', 7.99, 'one_time', 500, 25, 'published'),
  ('coins_1200', '1,200 Coins', 'More coins for active supporters.', 14.99, 'one_time', 1200, 100, 'published'),
  ('coins_5000', '5,000 Coins', 'Large creator support pack.', 49.99, 'one_time', 5000, 700, 'published')
) as v(code, display_name, description, price, period, coins, bonus, status)
join public.monetization_packages p on p.code = v.code
on conflict (package_id, version_number) do nothing;

insert into public.store_products (package_version_id, platform, store_product_id, revenuecat_offering_id, revenuecat_entitlement_id, status)
select pv.id, platform.platform,
  'com.diversasolutions.vuqiro.' || case
    when p.code like 'creator_%' then replace(p.code, 'creator_', 'creator.') || '.monthly'
    when p.code like 'coins_%' then replace(p.code, 'coins_', 'coins.')
    else replace(p.code, 'boost_', 'boost.')
  end,
  case when p.type = 'creator_subscription_tier' then 'creator_memberships'
       when p.type = 'coin_pack' then 'coins' else 'boosts' end,
  case when p.type = 'creator_subscription_tier' then p.code else null end,
  'configured'
from public.monetization_package_versions pv
join public.monetization_packages p on p.id = pv.package_id
cross join (values ('ios'), ('android')) as platform(platform)
where pv.status = 'published'
on conflict (platform, store_product_id) do nothing;

-- ---------------------------------------------------------------------------
-- Wallet for the viewer test account
-- ---------------------------------------------------------------------------

insert into public.wallets (profile_id, coin_balance)
select id, 1250 from public.profiles where handle = 'vuqiro_viewer'
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------

insert into public.feature_flags (key, description, enabled, environment) values
  ('boost_purchases', 'Allow buying video boosts', false, 'production'),
  ('coin_tips', 'Allow sending coin tips to creators', true, 'all'),
  ('creator_subscriptions', 'Creator subscription purchases', true, 'all'),
  ('video_upload', 'Allow video uploads', true, 'all'),
  ('new_user_signup', 'Allow new account creation', true, 'all')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Legal documents
-- ---------------------------------------------------------------------------

insert into public.legal_documents (type, version, title, status, published_at) values
  ('terms', 1, 'Terms of Service', 'published', now()),
  ('privacy', 1, 'Privacy Policy', 'published', now()),
  ('community_guidelines', 1, 'Community Guidelines', 'published', now()),
  ('creator_terms', 1, 'Creator Terms', 'published', now()),
  ('payout_terms', 1, 'Payout Terms', 'published', now()),
  ('copyright_takedown', 1, 'Copyright & Takedown Policy', 'draft', null),
  ('refund_policy', 1, 'Refund Policy', 'draft', null)
on conflict (type, version) do nothing;

-- ===========================================================================
-- 99-completion seed additions
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- One admin per role (console RBAC can be exercised immediately)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000b', 'admin@vuqiro.app', '{"handle":"vuqiro_ops","display_name":"Ops Admin"}'),
  ('00000000-0000-4000-8000-00000000000c', 'moderator@vuqiro.app', '{"handle":"vuqiro_mod","display_name":"Moderator"}'),
  ('00000000-0000-4000-8000-00000000000d', 'finance@vuqiro.app', '{"handle":"vuqiro_fin","display_name":"Finance"}'),
  ('00000000-0000-4000-8000-00000000000e', 'support@vuqiro.app', '{"handle":"vuqiro_sup","display_name":"Support"}')
on conflict (id) do nothing;

insert into public.admin_users (auth_user_id, email, display_name, role) values
  ('00000000-0000-4000-8000-00000000000b', 'admin@vuqiro.app', 'Ops Admin', 'admin'),
  ('00000000-0000-4000-8000-00000000000c', 'moderator@vuqiro.app', 'Moderator', 'moderator'),
  ('00000000-0000-4000-8000-00000000000d', 'finance@vuqiro.app', 'Finance', 'finance'),
  ('00000000-0000-4000-8000-00000000000e', 'support@vuqiro.app', 'Support', 'support')
on conflict (auth_user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Content taxonomy: categories, hashtags, sounds
-- ---------------------------------------------------------------------------

insert into public.categories (slug, label, sort_order) values
  ('music', 'Music', 1),
  ('comedy', 'Comedy', 2),
  ('food', 'Food', 3),
  ('fitness', 'Fitness', 4),
  ('travel', 'Travel', 5),
  ('tech', 'Tech', 6),
  ('fashion', 'Fashion', 7),
  ('education', 'Education', 8)
on conflict (slug) do nothing;

insert into public.hashtags (tag, view_count)
select distinct unnest(hashtags), 1000 from public.videos
on conflict (tag) do nothing;

insert into public.video_hashtags (video_id, hashtag_id)
select v.id, h.id
from public.videos v
join public.hashtags h on h.tag = any(v.hashtags)
on conflict do nothing;

insert into public.sounds (title, artist_name, source, duration_seconds) values
  ('Golden Hour Loop', 'Vuqiro Library', 'library', 30),
  ('City Nights', 'Vuqiro Library', 'library', 24),
  ('Kitchen Rhythm', 'Sola', 'original', 42)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Engagement: follows, likes, saves, comments
-- (counter triggers keep the denormalized counts consistent)
-- ---------------------------------------------------------------------------

insert into public.follows (follower_id, creator_id)
select p.id, c.id
from public.profiles p
cross join public.creators c
join public.profiles cp on cp.id = c.profile_id
where p.handle = 'vuqiro_viewer' and cp.handle in ('maya','solacooks','kaimoves')
on conflict do nothing;

insert into public.likes (profile_id, video_id)
select p.id, v.id
from public.profiles p
join public.videos v on v.visibility = 'public'
where p.handle = 'vuqiro_viewer'
on conflict do nothing;

insert into public.saves (profile_id, video_id)
select p.id, v.id
from public.profiles p
join public.videos v on v.caption like '3-ingredient%'
where p.handle = 'vuqiro_viewer'
on conflict do nothing;

insert into public.comments (video_id, author_id, text)
select v.id, p.id, c.text
from (values
  ('A quick moment from tonight''s session.', 'vuqiro_viewer', 'This is on repeat all week.'),
  ('3-ingredient street tacos in 60 seconds.', 'vuqiro_viewer', 'Made these tonight — unreal.'),
  ('Full-body warmup you can do anywhere.', 'maya', 'Adding this to my morning routine!')
) as c(caption, handle, text)
join public.videos v on v.caption = c.caption
join public.profiles p on p.handle = c.handle;

-- ---------------------------------------------------------------------------
-- Viewer settings: personalized ads opted in so ad targeting is exercisable
-- ---------------------------------------------------------------------------

insert into public.profile_settings (profile_id, personalized_ads_opt_in)
select id, true from public.profiles where handle = 'vuqiro_viewer'
on conflict (profile_id) do update set personalized_ads_opt_in = true;

insert into public.user_interests (profile_id, interest)
select p.id, i.interest
from public.profiles p
cross join (values ('food'), ('fitness'), ('music')) as i(interest)
where p.handle = 'vuqiro_viewer'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Creator economy: membership, revenue ledger, payout account, payout
-- ---------------------------------------------------------------------------

insert into public.creator_memberships (profile_id, creator_id, tier, status, platform)
select p.id, c.id, 'support', 'active', 'admin_manual'
from public.profiles p
join public.profiles cp on cp.handle = 'maya'
join public.creators c on c.profile_id = cp.id
where p.handle = 'vuqiro_viewer'
on conflict do nothing;

insert into public.creator_revenue_ledger (creator_id, source, gross_amount, platform_fee_amount, net_amount, status)
select c.id, e.source, e.gross, e.fee, e.net, e.status
from (values
  ('maya', 'subscription', 2.99, 0.60, 2.39, 'payable'),
  ('maya', 'unlock', 5.00, 1.00, 4.00, 'payable'),
  ('solacooks', 'tip', 12.00, 2.40, 9.60, 'pending')
) as e(handle, source, gross, fee, net, status)
join public.profiles p on p.handle = e.handle
join public.creators c on c.profile_id = p.id;

insert into public.creator_payout_accounts (creator_id, provider, provider_account_id, status, payouts_enabled)
select c.id, 'stripe', 'acct_seed_' || p.handle, 'verified', true
from public.creators c
join public.profiles p on p.id = c.profile_id
where p.handle in ('maya', 'solacooks')
on conflict do nothing;

insert into public.creator_payouts (creator_id, amount, currency, status)
select c.id, 6.39, 'USD', 'payable'
from public.creators c
join public.profiles p on p.id = c.profile_id
where p.handle = 'maya';

-- ---------------------------------------------------------------------------
-- Ads: advertiser → account → campaigns → group → creatives → sponsorship
-- ---------------------------------------------------------------------------

insert into public.advertisers (id, name, legal_name, contact_email, contact_name, website_url, country, status, notes)
values
  ('20000000-0000-4000-8000-000000000001', 'Solstice Coffee', 'Solstice Coffee Roasters AB', 'marketing@solsticecoffee.example', 'Elin Berg', 'https://solsticecoffee.example', 'SE', 'active', 'Direct-sold Q3 sponsorship + always-on CPM.'),
  ('20000000-0000-4000-8000-000000000002', 'Nimbus Fitness', 'Nimbus Fitness Inc.', 'ads@nimbusfitness.example', 'Jordan Reyes', 'https://nimbusfitness.example', 'US', 'active', '')
on conflict (id) do nothing;

insert into public.ad_accounts (id, advertiser_id, name, currency, status) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Solstice Coffee — Main', 'USD', 'active'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Nimbus Fitness — Growth', 'USD', 'active')
on conflict (id) do nothing;

insert into public.ad_campaigns (id, ad_account_id, advertiser_id, name, objective, buying_type, status, total_budget_cents, daily_budget_cents, cpm_price_cents, starts_at, ends_at)
values
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'Solstice Cold Brew Summer', 'awareness', 'cpm', 'active', 150000, 10000, 650, now() - interval '30 days', now() + interval '60 days')
on conflict (id) do nothing;

insert into public.ad_campaigns (id, ad_account_id, advertiser_id, name, objective, buying_type, status, total_budget_cents, cpc_price_cents, starts_at)
values
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
   'Nimbus App Install Push', 'installs', 'cpc', 'paused', 80000, 45, now() - interval '14 days')
on conflict (id) do nothing;

insert into public.ad_campaigns (id, ad_account_id, advertiser_id, name, objective, buying_type, status, fixed_price_cents, starts_at, ends_at)
values
  ('22000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'Solstice Launch Week Takeover', 'awareness', 'fixed_sponsorship', 'active', 500000, now(), now() + interval '7 days')
on conflict (id) do nothing;

insert into public.ad_groups (id, campaign_id, name, status, placements, targeting, frequency_cap_per_day) values
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'Feed — coffee & food interests', 'active',
   array['feed'], '{"interests":["food"],"min_age":16}'::jsonb, 4),
  ('23000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'Feed + discover — fitness', 'active',
   array['feed','discover'], '{"interests":["fitness"],"min_age":16}'::jsonb, 3),
  ('23000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000003', 'Launch week takeover — feed', 'active',
   array['feed'], '{}'::jsonb, 6)
on conflict (id) do nothing;

insert into public.ad_creatives (id, ad_group_id, campaign_id, type, title, body, cta_label, cta_url, thumbnail_url, review_status, status)
values
  ('24000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
   'card', 'Cold brew, warm summer', 'Solstice Cold Brew — small-batch roasted, delivered to your door.', 'Shop now',
   'https://solsticecoffee.example/cold-brew', 'https://picsum.photos/seed/solstice/720/1280', 'approved', 'active'),
  ('24000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002',
   'card', 'Train smarter with Nimbus', 'Personalized workout plans that adapt to your progress.', 'Get the app',
   'https://nimbusfitness.example/download', 'https://picsum.photos/seed/nimbus/720/1280', 'approved', 'active'),
  ('24000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000003',
   'card', 'Solstice Launch Week', 'Celebrate launch week with 20% off every roast.', 'Explore',
   'https://solsticecoffee.example/launch', 'https://picsum.photos/seed/launch/720/1280', 'pending', 'active')
on conflict (id) do nothing;

insert into public.direct_sponsorship_deals (id, advertiser_id, campaign_id, name, description, fixed_price_cents, currency, status, starts_at, ends_at, invoice_reference)
values
  ('25000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003',
   'Launch Week Takeover', 'Fixed-price feed sponsorship during Vuqiro launch week.', 500000, 'USD', 'active',
   now(), now() + interval '7 days', 'INV-2026-0042')
on conflict (id) do nothing;

insert into public.platform_revenue_ledger (source, reference_type, reference_id, amount_cents, currency, description, idempotency_key) values
  ('sponsorship', 'direct_sponsorship_deal', '25000000-0000-4000-8000-000000000001', 500000, 'USD', 'Direct sponsorship: Launch Week Takeover', 'sponsorship:25000000-0000-4000-8000-000000000001'),
  ('coin_purchase', 'purchase', null, 128500, 'USD', 'Coin pack sales (seed)', 'seed:coin-sales-1')
on conflict do nothing;

insert into public.ad_billing_events (ad_account_id, campaign_id, type, amount_cents, currency, description, idempotency_key) values
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', 'fixed_fee', 500000, 'USD', 'Fixed sponsorship fee: Launch Week Takeover', 'sponsorship-fee:25000000-0000-4000-8000-000000000001')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Moderation: report + case, appeal, copyright claim, moderation rules
-- ---------------------------------------------------------------------------

insert into public.moderation_cases (id, target_type, target_id, reason, status, priority, report_count)
select '30000000-0000-4000-8000-000000000001', 'video', v.id, 'spam', 'open', 'medium', 1
from public.videos v where v.caption like 'City lights%'
on conflict (id) do nothing;

insert into public.reports (reporter_id, target_type, target_id, reason, status, moderation_case_id)
select p.id, 'video', v.id, 'spam', 'attached_to_case', '30000000-0000-4000-8000-000000000001'
from public.profiles p, public.videos v
where p.handle = 'vuqiro_viewer' and v.caption like 'City lights%';

insert into public.appeals (profile_id, case_id, target_type, target_id, message, status)
select p.id, '30000000-0000-4000-8000-000000000001', 'video', v.id,
  'This video is my own original content and does not violate the guidelines.', 'open'
from public.profiles p, public.videos v
where p.handle = 'riven' and v.caption like 'City lights%';

insert into public.copyright_claims (claimant_name, claimant_email, claimant_organization, target_video_id, description, status)
select 'Northlight Records', 'legal@northlight.example', 'Northlight Records AB', v.id,
  'The backing track at 0:12–0:40 is our copyrighted recording used without a license.', 'submitted'
from public.videos v where v.caption like 'A quick moment%';

insert into public.moderation_rules (name, description, rule_type, config, severity, action) values
  ('Rapid uploads', 'Flag accounts uploading more than 10 videos per hour.', 'rapid_uploads', '{"max_per_hour":10}', 'medium', 'flag'),
  ('Repeated reports', 'Open a case when a target gets 3+ distinct reports.', 'repeated_reports', '{"threshold":3}', 'high', 'create_case'),
  ('Banned keywords', 'Auto-hide comments containing banned keywords.', 'banned_keywords', '{"keywords":["scam-link.example"]}', 'high', 'auto_hide')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Platform settings, support case, integration health, notifications
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, description) values
  ('feed', '{"adFrequency":6,"maxAdsPerPage":3,"pageSize":10}', 'Feed pagination + ad insertion'),
  ('feed_weights', '{"recency":1,"engagement":1,"completion":1,"follow":1,"interest":1,"boost":1,"safety":1}', 'Recommendation ranking weights'),
  ('upload_limits', '{"maxDurationSeconds":180,"maxUploadsPerHour":10}', 'Upload limits'),
  ('moderation_thresholds', '{"autoReviewReportCount":3,"autoHideSafetyScore":30}', 'Moderation automation thresholds')
on conflict (key) do nothing;

insert into public.support_cases (profile_id, email, subject, body, status, priority)
select p.id, 'viewer@example.com', 'Purchase not credited',
  'I bought the 500 coin pack but my balance did not update.', 'open', 'high'
from public.profiles p where p.handle = 'vuqiro_viewer';

insert into public.integration_health_checks (provider, status, message) values
  ('supabase', 'ok', 'Seed snapshot'),
  ('video', 'mock', 'Mock video provider (seed snapshot)'),
  ('payments', 'mock', 'RevenueCat not configured (seed snapshot)'),
  ('payouts', 'mock', 'Mock payouts provider (seed snapshot)'),
  ('push', 'mock', 'Mock push provider (seed snapshot)');

insert into public.notifications (profile_id, type, title, body)
select p.id, 'system_notice', 'Welcome to Vuqiro', 'Your account is ready — start exploring the feed.'
from public.profiles p where p.handle = 'vuqiro_viewer';

-- ===========================================================================
-- Launch gap closure seed additions
-- ===========================================================================

-- One featured video so curation surfaces render immediately.
update public.videos v
set is_featured = true,
    featured_at = now(),
    featured_by = (select id from public.admin_users where role = 'platform_superadmin' limit 1)
where v.id = (select id from public.videos order by created_at limit 1);

-- Viewer mutes one creator (soft hide) so mute filtering is exercisable.
insert into public.mutes (muter_id, muted_profile_id)
select viewer.id, muted.id
from public.profiles viewer, public.profiles muted
where viewer.handle = 'vuqiro_viewer' and muted.handle = 'riven'
on conflict do nothing;

-- Viewer marked one video not interested (negative ranking signal).
insert into public.video_not_interested (profile_id, video_id)
select p.id, v.id
from public.profiles p
join public.creators c on c.profile_id = (select id from public.profiles where handle = 'riven')
join public.videos v on v.creator_id = c.id
where p.handle = 'vuqiro_viewer'
limit 1
on conflict do nothing;
