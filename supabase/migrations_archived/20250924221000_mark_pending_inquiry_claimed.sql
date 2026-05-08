-- SECURITY DEFINER RPC to mark a pending inquiry as claimed by token
-- This avoids permission/RLS issues from Edge and makes the flow idempotent

create or replace function public.mark_pending_inquiry_claimed(
  p_token text,
  p_user_id uuid,
  p_inquiry_id uuid
) returns boolean
language plpgsql
security definer
as $$
begin
  update public.pending_inquiries
  set claimed = true,
      claimed_at = now(),
      claimed_by = p_user_id,
      inquiry_id = p_inquiry_id
  where token = p_token;

  -- consider success even if no row matched (idempotency)
  return true;
end;
$$;

revoke all on function public.mark_pending_inquiry_claimed(text, uuid, uuid) from public;
grant execute on function public.mark_pending_inquiry_claimed(text, uuid, uuid) to anon, authenticated, service_role;
