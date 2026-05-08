-- Adjust RPC to accept uuid[] for selected_adjustment_ids to match table column type
-- If your column is public.inquiries.selected_adjustment_ids uuid[] this will align types

create or replace function public.claim_pending_inquiry_rpc(
  p_property_id uuid,
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_headcount int,
  p_selected_adjustment_ids uuid[],
  p_message text
) returns uuid
language plpgsql
security definer
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

revoke all on function public.claim_pending_inquiry_rpc(uuid, uuid, date, date, timestamptz, timestamptz, int, uuid[], text) from public;
grant execute on function public.claim_pending_inquiry_rpc(uuid, uuid, date, date, timestamptz, timestamptz, int, uuid[], text) to anon, authenticated, service_role;
