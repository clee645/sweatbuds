-- Drop the duplicate pairing push.
--
-- 0011 (partnerships_notify_joined -> notify-partner-joined) and 0012
-- (partnerships_notify_paired -> notify-paired) both fire on the same
-- pending -> active flip, so the inviter got two banners for one pairing.
-- Keep 0012: the app only handles its 'partner_paired' type (refreshing the
-- partnership before showing it). notify-paired now carries 0011's wording.

drop trigger if exists partnerships_notify_joined on public.partnerships;
drop function if exists public.notify_partner_joined();
