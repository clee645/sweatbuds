-- Partnership cleanup + realtime publication
-- 1. When a partnership row flips from pending -> active, delete any other
--    pending invite-code rows belonging to either user. This keeps the
--    "I generated my own code, then redeemed someone else's" case clean
--    and removes the orphaned codes that would otherwise stay valid forever.
-- 2. Add the partnerships table to the supabase_realtime publication so the
--    client can subscribe to postgres_changes for live pairing updates.

create or replace function public.cleanup_orphan_pending_partnerships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (old.status is null or old.status = 'pending') then
    delete from public.partnerships
    where id <> new.id
      and status = 'pending'
      and user_b is null
      and (user_a = new.user_a or user_a = new.user_b);
  end if;
  return new;
end;
$$;

drop trigger if exists partnerships_cleanup_orphans on public.partnerships;
create trigger partnerships_cleanup_orphans
  after update on public.partnerships
  for each row execute function public.cleanup_orphan_pending_partnerships();

-- Enable realtime for partnership status flips
alter publication supabase_realtime add table public.partnerships;
