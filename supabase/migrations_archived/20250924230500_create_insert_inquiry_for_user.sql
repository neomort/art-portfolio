-- Create SECURITY DEFINER RPC to insert an inquiry for a specific user
-- This bypasses RLS and avoids any ambiguity with the legacy pending flow RPC

create or replace function public.insert_inquiry_for_user(
  p_property_id uuid,
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_headcount integer,
  p_selected_adjustment_ids uuid[],
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Insert directly; rely on table defaults for id and timestamps
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
    coalesce(p_message, 'Guest inquiry'),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Ensure only server-side usage if desired; service role can always execute.
-- Grant to authenticated in case you want to call it from other edge functions/servers with user JWT.
grant execute on function public.insert_inquiry_for_user(
  uuid, uuid, date, date, timestamptz, timestamptz, integer, uuid[], text
) to authenticated;
