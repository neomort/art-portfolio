-- SECURITY DEFINER RPC to insert an inquiry, bypassing caller privileges/RLS
-- Adjust types if your schema differs

create or replace function public.claim_pending_inquiry_rpc(
  p_property_id uuid,
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_headcount int,
  p_selected_adjustment_ids text[],
  p_message text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    start_at,
    end_at,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_start_at,
    p_end_at,
    p_headcount,
    p_selected_adjustment_ids,
    p_message,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Lock down and grant to app roles
revoke all on function public.claim_pending_inquiry_rpc(uuid, uuid, date, date, timestamptz, timestamptz, int, text[], text) from public;
grant execute on function public.claim_pending_inquiry_rpc(uuid, uuid, date, date, timestamptz, timestamptz, int, text[], text) to anon, authenticated, service_role;
