-- Drop and recreate get_inquiry_counterparty_display RPC to include email/phone
-- This allows venue owners to contact customers from booking details

drop function if exists public.get_inquiry_counterparty_display(uuid[]);

create function public.get_inquiry_counterparty_display(inquiry_ids uuid[])
returns table (
  inquiry_id uuid,
  guest_user_id uuid,
  guest_full_name text,
  guest_email text,
  guest_phone text,
  guest_organization_id uuid,
  guest_organization_name text
)
language sql
security definer
set search_path = public
as $$
  select
    i.id as inquiry_id,
    i.user_id as guest_user_id,
    p.full_name as guest_full_name,
    p.email as guest_email,
    p.phone as guest_phone,
    p.primary_organization_id as guest_organization_id,
    o.name as guest_organization_name
  from inquiries i
  join profiles p on p.id = i.user_id
  left join organizations o on o.id = p.primary_organization_id
  where i.id = any(inquiry_ids)
    and (
      -- inquiry initiator
      i.user_id = auth.uid()
      -- venue owner (property owner)
      or exists (
        select 1
        from properties prop
        where prop.id = i.property_id
          and prop.venue_id = auth.uid()
      )
      -- org member: user belongs to org that owns the property
      or exists (
        select 1
        from properties prop
        join organization_members om
          on om.organization_id = prop.organization_id
         and om.user_id = auth.uid()
        where prop.id = i.property_id
      )
    );
$$;

revoke all on function public.get_inquiry_counterparty_display(uuid[]) from public;
grant execute on function public.get_inquiry_counterparty_display(uuid[]) to authenticated;
