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
